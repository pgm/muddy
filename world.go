package muddy

type Session struct {
	playerID int
}

type World struct {
	objects     map[int]*Object
	nextID      int
	ObjectClass *ClassDef
}

func NewWorld() *World {
	return &World{objects: make(map[int]*Object), nextID: 1, ObjectClass: NewClassDef("Object")}
}

func (w *World) AddObject(parent *Object, classDef *ClassDef) *Object {
	ID := w.nextID
	w.nextID += 1
	object := &Object{ID: ID, Parent: parent, properties: make(map[string]interface{}), classDef: classDef}
	for prop, value := range classDef.initialProperties {
		object.properties[prop] = value
	}
	w.objects[ID] = object
	if parent != nil {
		parent.Children = append(parent.Children, object)
	}
	return object
}

func removeObject(list []*Object, toRemove *Object) ([]*Object, bool) {
	for index, element := range list {
		if element == toRemove {
			return append(list[:index], list[index+1:]...), true
		}
	}
	return list, false
}

func (w *World) Move(a *Object, b *Object) {
	// move A to be a child of B
	if a.Parent != nil {
		var removed bool
		a.Parent.Children, removed = removeObject(a.Parent.Children, a)
		if !removed {
			panic("element wasn't in child array")
		}
	}
	a.Parent = b
	b.Children = append(b.Children, a)
}

func (w *World) Clone() *World {
	newObjects := make(map[int]*Object)
	for id, obj := range w.objects {
		newProperties := make(map[string]interface{})
		for prop, value := range obj.properties {
			newProperties[prop] = value
		}
		// copy fields which don't reference *Objects. We'll do the rest in a second pass
		newObjects[id] = &Object{ID: id, properties: newProperties, classDef: obj.classDef}
	}

	for id, obj := range w.objects {
		// now fill in all the object pointers
		newObj := newObjects[id]
		if obj.Parent != nil {
			newObj.Parent = newObjects[obj.Parent.ID]
		}

		newObj.Children = make([]*Object, len(obj.Children))
		for i, child := range obj.Children {
			newObj.Children[i] = newObjects[child.ID]
		}
	}

	return &World{objects: newObjects}
}

// format of markup
// text is normal by default
// [Name] signifies it's an object by name (maybe obj ID ?)
// [Name text]
