package muddy

import (
	"encoding/json"
	"log"
	"net/http"
	"text/template"

	"math/rand"

	"sync/atomic"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

// I WISH IT WOULD BE HALLOWEEN 5-EVER!!!!!!
type Universe struct {
	clientIDCounter         uint32
	events                  chan interface{}
	worlds                  map[string]*WorldBasics
	clients                 map[int]*Client
	clientCountPerSessionID map[string]int
}

func newUniverse() *Universe {
	return &Universe{events: make(chan interface{})}
}

func (universe *Universe) eventLoop() {
	clients := universe.clients

	for {
		event, ok := <-universe.events
		if !ok {
			break
		}

		switch e := event.(type) {
		case *NewClientEvent:
			log.Printf("New client (%d)", e.client.ID)
			clients[e.client.ID] = e.client

			world, worldExists := universe.worlds[e.client.worldID]
			if !worldExists {
				world = NewWorldBasics(NewWorld())
				go world.eventLoop()
			}

			existingClientCount := universe.clientCountPerSessionID[e.client.sessionID]
			if existingClientCount == 0 {
				playerIDChan := make(chan int)
				world.events <- &NewPlayerEvent{sessionID: e.client.sessionID, playerIDChan: playerIDChan}
				playerID := <-playerIDChan
				e.client.playerID = playerID
			}
			universe.clientCountPerSessionID[e.client.sessionID] = existingClientCount + 1

		case *ClientDisconnectEvent:
			log.Printf("Disconnected client (%d)", e.client.ID)
			world := universe.worlds[e.client.worldID]
			existingClientCount := universe.clientCountPerSessionID[e.client.sessionID] - 1
			if existingClientCount == 0 {
				world.events <- &DisconnectedPlayerEvent{e.client.sessionID}
				log.Printf("Disconnected player (%d)", e.client.ID)
			}
			universe.clientCountPerSessionID[e.client.sessionID] = existingClientCount
			delete(clients, e.client.ID)

		case *ClientMessageEvent:
			handleMessage(e.client.sessionID, universe.worlds[e.client.worldID], e.message)

		case *NewSnapshotEvent:
			for _, client := range clients {
				client.snapshotChan <- &PlayerSnapshot{snapshot: e.snapshot, playerID: client.playerID}
			}
		}
	}

	for _, client := range clients {
		close(client.send)
	}
}

type ClientMessage struct {
	ObjectID int
	Method   string
	Args     []string
}

func handleMessage(sessionID string, world *WorldBasics, messageJSON []byte) {
	var message ClientMessage
	if err := json.Unmarshal(messageJSON, &message); err != nil {
		log.Printf("failed to unmarshal: %v", err)
	} else {
		world.events <- &GameEvent{sessionID: sessionID, objectID: message.ObjectID, method: message.Method, args: message.Args}
	}
}

func serveHome(w http.ResponseWriter, r *http.Request) {
	log.Println(r.URL)
	if r.URL.Path != "/" {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	http.ServeFile(w, r, "home.html")
}

var lettersAndNumbers = []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")

func randomString(n int) string {
	b := make([]rune, n)
	for i := range b {
		b[i] = lettersAndNumbers[rand.Intn(len(lettersAndNumbers))]
	}
	return string(b)
}

func newGame(w http.ResponseWriter, r *http.Request) {
	gameID := randomString(8)
	http.Redirect(w, r, "/game/"+gameID, http.StatusSeeOther)
}

func newPlayer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	gameID := vars["gameID"]
	playerID := randomString(8)
	http.Redirect(w, r, "/game/"+gameID+"/"+playerID, http.StatusSeeOther)
}

func gameUI(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	gameID := vars["gameID"]
	sessionID := vars["sessionID"]
	websocketURL := "/game/" + gameID + "/" + sessionID + "/ws"

	t, err := template.New("foo").Parse(`{{define "T"}}<html><body>{{.}}</body></html>`)
	if err != nil {
		log.Fatalf("Error parsing template: %s", err)
	}

	err = t.ExecuteTemplate(w, "T", websocketURL)
	if err != nil {
		log.Fatalf("Error executing template: %s", err)
	}
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func serveWs(universe *Universe, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["sessionID"]
	worldID := vars["worldID"]

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	clientID := int(atomic.AddUint32(&universe.clientIDCounter, 1))
	client := &Client{ID: clientID, universe: universe, conn: conn, send: make(chan []byte, 256), snapshotChan: make(chan *PlayerSnapshot), sessionID: sessionID, worldID: worldID}
	go inboundMessageLoop(client)
	go outboundMessageLoop(client)

	go ClientNotificationLoop(client.sessionID, client.snapshotChan, func(diff *Diff) bool {
		client.send <- []byte(diff.JSON)
		return true
	})

	client.universe.events <- &NewClientEvent{client: client}
}

func outboundMessageLoop(client *Client) {
	for {
		message, ok := <-client.send
		if !ok {
			client.conn.WriteMessage(websocket.CloseMessage, []byte{})
			break
		}
		client.conn.WriteMessage(websocket.TextMessage, message)
	}
}

func inboundMessageLoop(client *Client) {
	defer func() {
		client.universe.events <- &ClientDisconnectEvent{client: client}
		client.conn.Close()
	}()

	for {
		_, message, err := client.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}
		client.universe.events <- &ClientMessageEvent{client: client, message: message}
	}
}

func main(addr string) {
	universe := newUniverse()
	go universe.eventLoop()

	r := mux.NewRouter()
	r.HandleFunc("/", serveHome)
	r.HandleFunc("/game", newGame)
	r.HandleFunc("/game/{gameID}", newPlayer)
	r.HandleFunc("/game/{gameID}/{sessionID}", gameUI)
	r.HandleFunc("/game/{gameID}/{sessionID}/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(universe, w, r)
	})
	http.Handle("/", r)

	err := http.ListenAndServe(addr, nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
