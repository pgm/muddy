import React from "react";
import { Settings } from "./Settings";

export default {
  title: "Components/Settings",
  component: Settings,
};

export const ViewSettings = () => {

  const devices=[
    { deviceId: "1",
    groupId: "1",
    kind: ("audioinput" as MediaDeviceKind),
    label: "A1", toJSON: ()=> ("" as any)},
    { deviceId: "2",
    groupId: "2",
    kind: ("audiooutput" as MediaDeviceKind),
    label: "A2", toJSON: ()=>("" as any)},
    { deviceId: "3",
    groupId: "3",
    kind: ("videoinput" as MediaDeviceKind),
    label: "A3", toJSON: ()=>("" as any)}
  ];

  console.log("deviceList", devices)

  return <Settings 
    onVideoInputChange={(id) => console.log(id)}
    onAudioInputChange={(id: string) => {console.log(id)}} 
    onAudioOutputChange={ (id: string) => console.log(id) }
    deviceList={devices}
    audioInputDeviceId="1"
    audioOutputDeviceId="2"
    videoInputDeviceId="3"
  />;
};
