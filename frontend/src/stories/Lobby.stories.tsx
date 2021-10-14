import React from 'react';
import { ComponentStory, ComponentMeta } from '@storybook/react';

interface LobbyProps {
  onSubmitName: (name : string) => void;
}

export const Lobby = ({ onSubmitName }: LobbyProps) => {
  const [name, setName] = React.useState("")
  return (
  <div>
  <h1>
    Enter name
  </h1>
  <input type="text" onChange={(e) => setName(e.target.value)}/>
  <button onClick={(e) => onSubmitName(name)}>Submit</button>
  </div>
);
}


export default {
  title: 'Lobby',
  component: Lobby,
} as ComponentMeta<typeof Lobby>;

export const Sample = () => <Lobby onSubmitName={(name: string) => { console.log(name) } }/>

