package muddy

import (
	"bytes"
	"encoding/json"
	"fmt"
)

type Action struct {
	Type     string
	Label    string
	objectID string
}

type Block struct {
	Type    string
	Text    string
	ID      *string
	Actions []*Action
}

type FormRow struct {
	caption string
	guess   string
	correct bool
}

type FormView struct {
	Title        string
	SuppressDone bool
	Rows         []*FormRow
}

type ModalView struct {
	Type     string
	ID       string
	Form     *FormView
	URL      *string
	HTML     *string
	showDone bool
}

type View struct {
	Content       []*Block
	Modal         *ModalView
	JitsiMode     *string
	TimeRemaining float64
}

// export interface NormalGameView extends GameView {
// 	content: Array<Block>;
// 	modal?: ModalView;
// 	jitsi_mode?: string;
// 	time_remaining: number;
//   }

//   export interface ModalView {
// 	type: string;
// 	id: string;
// 	form?: FormView;
// 	url?: string;
// 	html?: string;
// 	show_done?: boolean;
// 	tiles?: Array<Array<string>>;
//   }

func (v *View) Diff(newView *View) *Diff {
	buf := bytes.NewBuffer(nil)
	err := json.NewEncoder(buf).Encode(newView)
	if err != nil {
		panic(fmt.Sprintf("error encoding json: %v", err))
	}
	return &Diff{JSON: buf.String()}
}

type Diff struct {
	JSON string
}

func ClientNotificationLoop(sessionID string, snapshotChan chan *PlayerSnapshot, send func(*Diff) bool) {
	var prevView *View
	for {
		snapshot, ok := <-snapshotChan
		if !ok {
			break
		}
		view := snapshot.snapshot.GetView(snapshot.playerID)
		diff := prevView.Diff(view)
		if diff != nil {
			ok = send(diff)
			if !ok {
				break
			}
		}
	}
}
