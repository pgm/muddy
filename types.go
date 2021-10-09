package muddy

import (
	"fmt"
	"log"
	"reflect"
	"strings"
)

type Context struct {
	Player *Object
}

type MethodType func(*Object, *Context, []interface{}) interface{}

type ClassDef struct {
	// this is an immutable class. As in, after we construct it, we
	// promise no one will mutate it, so it's safe for multiple threads
	// to access.
	Name              string
	classNames        map[string]bool
	methodDispatch    map[string]MethodType
	initialProperties map[string]interface{}
}

func (c *ClassDef) Call(methodName string, obj *Object, ctx *Context, args ...interface{}) interface{} {
	method := c.methodDispatch[methodName]
	return method(obj, ctx, args)

}

func NewClassDef(name string) *ClassDef {
	return &ClassDef{Name: name, classNames: make(map[string]bool), methodDispatch: make(map[string]MethodType),
		initialProperties: make(map[string]interface{})}
}

func (classDef *ClassDef) Subclass(name string) *ClassDef {
	newClassNames := make(map[string]bool)
	for k, v := range classDef.classNames {
		newClassNames[k] = v
	}
	newClassNames[name] = true

	newInitProps := make(map[string]interface{})
	for k, v := range classDef.initialProperties {
		newInitProps[k] = v
	}

	newMethodDispatch := make(map[string]MethodType)
	for k, v := range classDef.methodDispatch {
		newMethodDispatch[k] = v
	}

	return &ClassDef{Name: name,
		classNames:        newClassNames,
		methodDispatch:    newMethodDispatch,
		initialProperties: newInitProps}
}

func (c *ClassDef) AddGetter(name string, initialValue interface{}) *ClassDef {
	c.AddMethod("get"+strings.ToUpper(name[0:1])+name[1:], MakeGetter(name))
	c.AddProperty(name, initialValue)
	return c
}

func (c *ClassDef) AddProperty(name string, initialValue interface{}) *ClassDef {
	c.initialProperties[name] = initialValue
	return c
}

func (c *ClassDef) AddMethod(name string, method interface{}) *ClassDef {
	ContextPtrType := reflect.TypeOf(&Context{})
	ObjectPtrType := reflect.TypeOf(&Object{})

	t := reflect.TypeOf(method)
	v := reflect.ValueOf(method)
	adapter := func(obj *Object, context *Context, args []interface{}) interface{} {
		valueArgs := make([]reflect.Value, t.NumIn())

		destIndex := 0
		if destIndex < t.NumIn() && t.In(destIndex) == ObjectPtrType {
			valueArgs[destIndex] = reflect.ValueOf(obj)
			destIndex++
		}

		if destIndex < t.NumIn() && t.In(destIndex) == ContextPtrType {
			valueArgs[destIndex] = reflect.ValueOf(context)
			destIndex++
		}

		if t.NumIn() != len(args)+destIndex {
			panic(fmt.Sprintf("Could not call %s because it expects %d args, but called with %d args", t.Name(), t.NumIn(), len(args)+destIndex))
		}
		for i, arg := range args {
			valueArgs[i+destIndex] = reflect.ValueOf(arg)
		}

		result := v.Call(valueArgs)
		if len(result) > 1 {
			panic(fmt.Sprintf("Expect %s to return nothing or one value, but it returned %d", t.Name(), len(result)))
		}
		//assert len(result) == 0 || 1
		if len(result) > 0 {
			return result[0].Interface()
		} else {
			return nil
		}
	}

	c.methodDispatch[name] = adapter
	return c
}

type Object struct {
	ID         int
	Parent     *Object
	Children   []*Object
	properties map[string]interface{} // map is mutable but values are immutable
	classDef   *ClassDef
}

func (obj *Object) IsInstanceOf(className string) bool {
	_, ok := obj.classDef.classNames[className]
	return ok
}

func FilterByClass(objs []*Object, className string) []*Object {
	filtered := make([]*Object, 0, len(objs))
	for _, obj := range objs {
		if obj.IsInstanceOf(className) {
			filtered = append(filtered, obj)
		}
	}
	return filtered
}

func (obj *Object) Call(ctx *Context, methodName string, args ...interface{}) interface{} {
	method, ok := obj.classDef.methodDispatch[methodName]
	if !ok {
		methodNames := make([]string, 0)
		for methodName := range obj.classDef.methodDispatch {
			methodNames = append(methodNames, methodName)
		}
		log.Fatalf("Could not find method \"%s\" on class \"%s\" (Methods: %v)", methodName, obj.classDef.Name, methodNames)
	}
	return method(obj, ctx, args)
}

func (obj *Object) Set(name string, value interface{}) *Object {
	obj.properties[name] = value
	return obj
}

func (obj *Object) Get(name string) interface{} {
	return obj.properties[name]
}

func (obj *Object) Append(name string, value interface{}) *Object {
	list := obj.Get(name).([]interface{})

	newList := append([]interface{}(nil), list...)
	newList = append(newList, value)

	obj.Set(name, newList)

	return obj
}

func MakeGetter(name string) func(obj *Object) interface{} {
	return func(obj *Object) interface{} {
		return obj.Get(name)
	}
}
