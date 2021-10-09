package muddy

func markupToBlocks(text string) []*Block {
	return []*Block{NewTextBlock(text)}
}

func NewTextBlock(text string) *Block {
	return &Block{Type: "text", Text: text}
}

func (w *World) GetView(playerID int) *View {
	player := w.objects[playerID]

	room := player.Parent
	ctx := &Context{Player: player}

	description := room.Call(ctx, "getDescription").(string)

	return &View{Content: markupToBlocks(description)}
}

// type Exit struct {

// }

// // Happy halloween! ( soon )
// type Room struct {
// 	GetDescription func(*Room, *Context) string
// 	GetImage func(*Room, *Context) string
// 	GetExits func(*Room, *Context) []*Exit
// 	GetContents func(*Room, *Context) []*Object
// 	GetPlayers func(*Room, *Context) []*Player
// }

// func filterObjsByType(world *World, type_ string, dest []*interface{}) {

// }

// func (w *World) GetRooms() []*Room {
// 	panic("unimp")
// }

// func (w *World) Move(object *Object, newOwner *Object) {

// }

// func (w *World) IsInSameRoom(a *Object, b *Object) bool {

// }

// // type Player struct {

// // }

// // type Context struct {
// // 	Player *Player
// // }

// world:
// get_rooms() -> List[Room]
// get_players() -> List[Player]
// get_objects() -> List[Obj]
// assign_owner(Obj, Player | Room)
// move(Player, Room)
// is_in_same_room(Player | Item | Part, Player | Item | Part)
// broadcast(message)

// Item:
// get_actions() -> List[str]
// get_description() -> Markup
// get_owner() -> Room | Player
// set_owner(Room | Player)
// perform_action(action, parameters...) -> void
// get_view() -> JSON
// is_instance_of(className: str)
// get_id() -> int

// player:
// get_inventory() -> List[Obj]
// add_to_inventory(Obj) -> void
// remove_from_inventory(Obj) -> void
// get_room() -> room
// set_room(Room) -> void
// set_focus(Obj) -> void
// get_focus(Obj) -> Obj
