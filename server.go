package muddy

import (
	"encoding/json"
	"log"
	"net"
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
	worldBuilder            func() *WorldBasics
}

func newUniverse(worldBuilder func() *WorldBasics) *Universe {
	return &Universe{events: make(chan interface{}),
		worlds:                  make(map[string]*WorldBasics),
		clients:                 make(map[int]*Client),
		clientCountPerSessionID: make(map[string]int),
		worldBuilder:            worldBuilder,
	}
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
				log.Printf("Creating world %s", e.client.worldID)
				world = universe.worldBuilder()
				go world.eventLoop(func(w *World) {
					universe.events <- &NewSnapshotEvent{snapshot: w, worldID: e.client.worldID}
				})
				universe.worlds[e.client.worldID] = world
			}

			existingClientCount := universe.clientCountPerSessionID[e.client.sessionID]
			if existingClientCount == 0 {
				log.Printf("Creating new sesion %s", e.client.sessionID)
				playerIDChan := make(chan int)
				log.Printf("Sending to %v", world.events)
				world.events <- &NewPlayerEvent{sessionID: e.client.sessionID, playerIDChan: playerIDChan}
				log.Printf("Waiting for player ID")
				playerID := <-playerIDChan
				e.client.playerID = playerID
				log.Printf("Session %s is associated with player %d", e.client.sessionID, e.client.playerID)
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
				if e.worldID == client.worldID {
					client.snapshotChan <- &PlayerSnapshot{snapshot: e.snapshot, playerID: client.playerID}
				}
			}
		}
	}

	for _, client := range clients {
		close(client.send)
	}
}

type ClientMessage struct {
	ObjectID *int     `json:"objectID"`
	Method   *string  `json:"method"`
	Args     []string `json:"args"`
}

func handleMessage(sessionID string, world *WorldBasics, messageJSON []byte) {
	var message ClientMessage
	if err := json.Unmarshal(messageJSON, &message); err != nil {
		log.Printf("failed to unmarshal: %v", err)
	} else {
		if message.ObjectID == nil || message.Method == nil {
			log.Printf("Required field on message was missing (message: %s)", messageJSON)
		} else {
			log.Printf("sending game event to world (sessionID: %s, objectID: %d, method: %s, args: %v)", sessionID, *message.ObjectID, *message.Method, message.Args)
			world.events <- &GameEvent{sessionID: sessionID, objectID: *message.ObjectID, method: *message.Method, args: message.Args}
		}
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
	// http.ServeFile(w, r, "home.html")
	w.Write([]byte("<html><body><a href=\"/game\">Go</a></body></html>"))
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

type gameUIData struct {
	URL string
}

func gameUI(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	gameID := vars["gameID"]
	sessionID := vars["sessionID"]
	websocketURL := "/game/" + gameID + "/" + sessionID + "/ws"

	t, err := template.New("foo").Parse(`<html><body>{{.URL}}</body></html>`)
	if err != nil {
		log.Fatalf("Error parsing template: %s", err)
	}

	err = t.Execute(w, &gameUIData{URL: websocketURL})
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

func createServer(worldBuilder func() *WorldBasics) *http.Server {
	universe := newUniverse(worldBuilder)
	go universe.eventLoop()

	r := mux.NewRouter()
	r.HandleFunc("/", serveHome)
	r.HandleFunc("/game", newGame)
	r.HandleFunc("/game/{gameID}", newPlayer)
	r.HandleFunc("/game/{gameID}/{sessionID}", gameUI)
	r.HandleFunc("/game/{gameID}/{sessionID}/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(universe, w, r)
	})

	srv := &http.Server{
		Handler: r,
	}
	return srv
}

func createListener(addr string) net.Listener {
	log.Printf("Listening on %s...", addr)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatal("net.Listen: ", err)
	}
	return ln
}

func Start(addr string, worldBuilder func() *WorldBasics) {
	srv := createServer(worldBuilder)
	ln := createListener(addr)

	err := srv.Serve(ln)
	if err != nil {
		log.Fatal("srv.Serve(ln): ", err)
	}
}
