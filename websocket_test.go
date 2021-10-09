package muddy

import (
	"context"
	"log"
	"testing"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
)

func TestWSBasics(t *testing.T) {
	addr := "127.0.0.1:2700"

	builder := func() *WorldBasics {
		return NewWorldBasics(NewWorld())
	}

	srv := createServer(builder)
	ln := createListener(addr)

	go func() {
		err := srv.Serve(ln)
		if err != nil {
			log.Printf("srv.Serve(ln): %s", err)
		}
		log.Printf("server shutdonw")
	}()

	c, _, err := websocket.DefaultDialer.Dial("ws://"+addr+"/game/gameid/sessionid/ws", nil)
	assert.Nil(t, err)

	err = c.WriteMessage(websocket.TextMessage, []byte(`{"name": "duck"}`))
	assert.Nil(t, err)

	_, buf, err := c.ReadMessage()
	assert.Nil(t, err)
	log.Printf("Received: %s", string(buf))

	c.Close()

	srv.Shutdown(context.Background())
}
