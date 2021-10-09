package muddy

import (
	"github.com/gorilla/websocket"
)

type PlayerSnapshot struct {
	playerID int
	snapshot *World
}

type Client struct {
	ID           int
	sessionID    string
	worldID      string
	universe     *Universe
	conn         *websocket.Conn
	send         chan []byte
	snapshotChan chan *PlayerSnapshot
	playerID     int
}

type NewClientEvent struct {
	client *Client
}

type ClientDisconnectEvent struct {
	client *Client
}

type ClientMessageEvent struct {
	client  *Client
	message []byte
}

type NewSnapshotEvent struct {
	snapshot *World
	worldID  string
}
