import React from 'react';
import { ComponentStory, ComponentMeta } from '@storybook/react';

interface Block {
    text : string
    actions?: string[]
    objectID?: number
}

interface RoomProps {
  image : string
  content : Block[]
  videoFeeds : string[]
}

export const Room = ({ image, content, videoFeeds }: RoomProps) => {
    let spans = [];
    content.forEach( (block) => {
        if(block.objectID) {
            spans.push(<span className="object-actions">{block.text}</span>)
        } else {
            spans.push(<span>{block.text}</span>)
        }
    });
  return (
  <div style={ {display: "grid", gridTemplateRows: "600px", gridTemplateColumns: "600px 400px", width: "100%", height: "100%"}  }>
      <div style={ {gridColumn: 1, gridRow: 1, background: "center / contain no-repeat url(\""+image+"\")",} }>
      {/* <img src={image} style={ {position: "absolute"}}/> */}
      <div style={ {display: "flex", justifyContent: "center", alignItems: "center", width:"100%", height: "100%"}}>
          {videoFeeds.map( (url) => <img style={ {width: "100px", margin: "20px", borderRadius:"50px", border: "3px solid black"} } src={url}/> )}
      </div>
      </div>
      <div style={ {gridColumn: 2, gridRow: 1, backgroundColor: "green"} }>
          {spans}
      </div>
  </div>
);
}


export default {
  title: 'Room',
  component: Room,
} as ComponentMeta<typeof Room>;

function mkimgs(n : number) {
    let result = [];
    for (let i = 0; i< n; i++) {
        result.push("https://placekitten.com/200/200")
    }
    return result;
}

export const Sample1 = () => <Room videoFeeds={mkimgs(1)} content={[{text: "This is "}, {text: "an object", objectID: 2, actions: ["take", "look"]}, {text:"."}]} image="/logo192.png"/>
export const Sample2 = () => <Room videoFeeds={mkimgs(2)} content={[{text: "This is "}, {text: "an object", objectID: 2, actions: ["take", "look"]}, {text:"."}]} image="/logo192.png"/>
export const Sample3 = () => <Room videoFeeds={mkimgs(3)} content={[{text: "This is "}, {text: "an object", objectID: 2, actions: ["take", "look"]}, {text:"."}]} image="/logo192.png"/>
export const Sample4 = () => <Room videoFeeds={mkimgs(4)} content={[{text: "This is "}, {text: "an object", objectID: 2, actions: ["take", "look"]}, {text:"."}]} image="/logo192.png"/>
export const Sample5 = () => <Room videoFeeds={mkimgs(5)} content={[{text: "This is "}, {text: "an object", objectID: 2, actions: ["take", "look"]}, {text:"."}]} image="/logo192.png"/>

