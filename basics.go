package muddy

import "log"

const RoomClassName = "Room"
const PlayerClassName = "Player"
const NamedClassName = "Named"
const ThingClassName = "Thing"
const ItemClassName = "Item"
const PartClassName = "Part"
const ExitClassName = "Exit"

func (w *WorldBasics) AddPlayer(name string, initialRoom *Object) *Object {
	if !initialRoom.IsInstanceOf(RoomClassName) {
		panic("Starting player not in a room")
	}
	return w.World.AddObject(initialRoom, w.Player).Set("name", name).Set("connected", true)
}

func (w *WorldBasics) PlayerDisconnected(playerID int) {
	player := w.World.objects[playerID]
	player.Set("connected", false)
}

func (w *WorldBasics) AddRoom(name string) *Object {
	return w.World.AddObject(nil, w.Room).Set("name", name)
}

func (w *WorldBasics) AddItem(room *Object, name string) *Object {
	return w.World.AddObject(room, w.Item).Set("name", name)
}

func (w *WorldBasics) AddExit(room *Object, destination *Object) *Object {
	exit := w.World.AddObject(room, w.Exit).Set("destinationID", destination.ID)
	return exit
}

func NewWorldBasics(world *World) *WorldBasics {
	Named := world.ObjectClass.Subclass(NamedClassName).AddGetter("name", "<blank>")
	Room := Named.Subclass(RoomClassName).AddGetter("description", "<blank>")
	Thing := Named.Subclass(ThingClassName).AddGetter("actions", []interface{}{"Go"})
	Item := Thing.Subclass(ItemClassName)
	Part := Thing.Subclass(PartClassName)
	Exit := Thing.Subclass(ExitClassName).AddMethod("getDestination", func(obj *Object) interface{} {
		destinationID := obj.Get("destinationID").(int)
		return world.objects[destinationID]
	}).AddMethod("Go", func(obj *Object, ctx *Context) {
		destination := world.objects[obj.Get("destinationID").(int)]
		world.Move(ctx.Player, destination)
	})

	LockedExit := Exit.Subclass("LockedExit").AddProperty("locked", true)
	LockedExit.AddMethod("getActions", func(obj *Object, ctx *Context) interface{} {
		actions := Exit.Call("getActions", obj, ctx).([]interface{})
		// if locked, filter "Go" out of the list of possible actions
		if obj.Get("locked").(bool) {
			newActions := make([]interface{}, len(actions))
			for _, action := range actions {
				if action.(string) != "Go" {
					newActions = append(newActions, action)
				}
			}
			actions = newActions
		}
		return actions
	})
	Player := Named.Subclass(PlayerClassName)

	basics := &WorldBasics{World: world,
		Named:    Named,
		Room:     Room,
		Thing:    Thing,
		Item:     Item,
		Part:     Part,
		Exit:     Exit,
		Player:   Player,
		events:   make(chan interface{}),
		sessions: make(map[string]*Session)}

	basics.Lobby = basics.AddRoom("lobby")
	basics.Lobby.Set("description", "A grand lobby")
	basics.Nowhere = basics.AddRoom("nowhere")

	return basics
}

type WorldBasics struct {
	World    *World
	sessions map[string]*Session

	// channels used by GameLoop
	events chan interface{}

	Named *ClassDef
	// base class for everything else
	// methods: GetName() -> str

	Room *ClassDef
	// 	GetDescription func(*Room, *Context) string
	// 	GetImage func(*Room, *Context) string
	// 	GetExits func(*Room, *Context) []*Exit
	// 	GetContents func(*Room, *Context) []*Object
	// 	GetPlayers func(*Room, *Context) []*Player

	// something that you can interact with
	Thing *ClassDef
	// methods:
	//  GetActions() -> List[str]
	//  GetDescription() -> str
	//  AddWatch(Player)
	//  RemoveWatch(Player)
	//  GetWatching() -> List[Player]

	// subclass of Thing, but also implies you can pick it up
	Item *ClassDef

	// subclass of Thing, which represents part of another thing (as identified by its "owner")
	Part *ClassDef

	Exit *ClassDef
	// methods: GetDestination() -> Room

	LockedExit *ClassDef

	Player *ClassDef
	// methods:
	// GetInventory() -> List[Object]
	// AddToInventory(Object)
	// RemoveFromInventory(Object)
	// SetFocus(Thing)
	// GetFocus() -> Thing

	// room where players start
	Lobby *Object

	// room where objects live before they're needed
	Nowhere *Object
}

type NewPlayerEvent struct {
	sessionID    string
	playerIDChan chan int
}

type DisconnectedPlayerEvent struct {
	sessionID string
}

type GameEvent struct {
	sessionID string
	objectID  int
	method    string
	args      []string
}

func (world *WorldBasics) eventLoop(newSnapshot func(*World)) {
	// read from events until channel is closed. For each event, update world and
	// send a fresh snapshot of the world to snapshotChan
	for {
		log.Printf("Reading event chan %v", world.events)
		event, ok := <-world.events
		if !ok {
			break
		}
		log.Printf("got event %v", event)

		switch e := event.(type) {
		case *NewPlayerEvent:
			handleNewPlayerEvent(world, e)
		case *DisconnectedPlayerEvent:
			handleDisconnectedPlayerEvent(world, e)
		case *GameEvent:
			handleGameEvent(world, e)
		}

		log.Printf("Sending out snapshot")
		// take a snapshot and notify anyone listening the new state of the world
		snapshot := world.World.Clone()
		newSnapshot(snapshot)
	}
}

func handleNewPlayerEvent(world *WorldBasics, e *NewPlayerEvent) {
	player := world.AddPlayer("", world.Lobby)
	world.sessions[e.sessionID] = &Session{playerID: player.ID}
	e.playerIDChan <- player.ID
	close(e.playerIDChan)
}

func handleDisconnectedPlayerEvent(world *WorldBasics, e *DisconnectedPlayerEvent) {
	session := world.sessions[e.sessionID]
	world.PlayerDisconnected(session.playerID)
}

func handleGameEvent(world *WorldBasics, event *GameEvent) {
	target := world.World.objects[event.objectID]
	session := world.sessions[event.sessionID]
	player := world.World.objects[session.playerID]
	ctx := &Context{Player: player}

	// copy array to one of the right type... Kind of annoying that this is necessary and not something
	// the spread operator could do for us.
	args := make([]interface{}, len(event.args))
	for i := range event.args {
		args[i] = event.args[i]
	}

	target.Call(ctx, event.method, args...)
}
