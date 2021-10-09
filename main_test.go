package muddy_test

import (
	"log"
	"testing"

	"github.com/pgm/muddy"
	"github.com/stretchr/testify/assert"
)

func TestObjectsBasics(t *testing.T) {
	world := muddy.NewWorld()

	Room := world.ObjectClass.Subclass("Room").AddMethod("getDescription", muddy.MakeGetter("description"))
	Item := world.ObjectClass.Subclass("Item").AddMethod("getName", muddy.MakeGetter("name"))

	Cave := world.AddObject(nil, Room).Set("description", "A big cave")
	world.AddObject(Cave, Item).Set("name", "fork")

	ctx := &muddy.Context{}
	assert.Equal(t, "A big cave", Cave.Call(ctx, "getDescription"))

}

type Tinyland struct {
	world *muddy.World

	Castle    *muddy.Object
	Beach     *muddy.Object
	TacoStand *muddy.Object
}

func NewTinyland(basic *muddy.WorldBasics) *Tinyland {
	tiny := &Tinyland{world: basic.World, Castle: basic.AddRoom("Castle"),
		Beach:     basic.AddRoom("Beach"),
		TacoStand: basic.AddRoom("Taco Stand")}

	basic.AddExit(tiny.Beach, tiny.Castle)
	basic.AddExit(tiny.Castle, tiny.Beach)

	basic.AddExit(tiny.Castle, tiny.TacoStand)
	basic.AddExit(tiny.TacoStand, tiny.Castle)

	return tiny
}

type Simulator struct {
	t     *testing.T
	ctx   *muddy.Context
	world *muddy.World
}

func (s *Simulator) setPlayer(player *muddy.Object) {
	assert.True(s.t, player.IsInstanceOf(muddy.PlayerClassName))
	s.ctx = &muddy.Context{Player: player}
}

func (s *Simulator) assertViewContainsObject(view *muddy.View, obj *muddy.Object) {
	log.Printf("Warning: assertViewContainsObject unimplemented")
}

func (s *Simulator) useExit(dest *muddy.Object) {
	curRoom := s.ctx.Player.Parent
	// find the exit that corresponds to this destination
	exits := muddy.FilterByClass(curRoom.Children, muddy.ExitClassName)
	for _, exit := range exits {
		if exit.Get("destinationID") == dest.ID {
			s.exec(exit, "Go")
			return
		}
	}
	panic("Could not find exit")
}

func (s *Simulator) exec(obj *muddy.Object, command string, args ...interface{}) {
	// simulate what'd happen when playing for real: Make a copy and render view
	snapshot := s.world.Clone()
	view := snapshot.GetView(s.ctx.Player.ID)
	// make sure this player can see object before interacting with it
	s.assertViewContainsObject(view, obj)

	obj.Call(s.ctx, command, args...)

	// make sure that computing the diff for the client doesn't panic or anything
	snapshot = s.world.Clone()
	nextView := snapshot.GetView(s.ctx.Player.ID)
	view.Diff(nextView)
}

func TestGamePlay(t *testing.T) {
	world := muddy.NewWorld()
	basic := muddy.NewWorldBasics(world)
	tiny := NewTinyland(basic)

	sim := &Simulator{t: t, world: tiny.world}

	joe := basic.AddPlayer("joe", tiny.Beach)

	// walk through all the rooms
	sim.setPlayer(joe)
	sim.useExit(tiny.Castle)
	sim.useExit(tiny.TacoStand)
	sim.useExit(tiny.Castle)
	sim.useExit(tiny.Beach)
}
