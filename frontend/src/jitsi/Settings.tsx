import React from "react";
import "./Settings.css";

interface Element {
  id: string
  label: string
}

interface SelectionProps {
  options : Element[]
  selection : string
  onChange : (id : string) => void
}

const Selection = (props : SelectionProps) => {
    const { options, selection, onChange} = props;

    return (
      <select
        value={selection}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        {options.map(
          (e) => (<option key={e.id} value={e.id}>
                {e.label}
              </option>)
            )}
      </select>
    );
  }

interface SettingsProps {
  videoInputDeviceId?: string;
  audioInputDeviceId?: string;
  audioOutputDeviceId?: string;

  deviceList : MediaDeviceInfo[];
  
  onVideoInputChange : (id: string) => void
  onAudioInputChange : (id: string) => void
  onAudioOutputChange : (id: string) => void
}

function subsetDevs(deviceList : MediaDeviceInfo[], kind: string) {
  return deviceList.filter( (d) => d.kind == kind ).map( (d) => { return {id: d.deviceId, label: d.label} } );
}

export const Settings = (props : SettingsProps) => {
  const videoInputs = subsetDevs(props.deviceList, "videoinput");
  const audioInputs = subsetDevs(props.deviceList, "audioinput");
  const audioOutputs = subsetDevs(props.deviceList, "audiooutput");

  console.log("videoInputs", videoInputs)

    return (
        <div className="jitsi-av-settings">
          <div>
          <span>Camera</span>
          <Selection options={videoInputs}
            selection={props.videoInputDeviceId || "default"}
            onChange={props.onVideoInputChange}
          />
          </div>
          <div>
          <span>Microphone</span>
          <Selection
            options={audioInputs}
            selection={props.audioInputDeviceId || "default"}
            onChange={props.onAudioInputChange}
          />
          </div>
          <div>
          <span>Speaker</span>
          <Selection
            options={audioOutputs}
            selection={props.audioOutputDeviceId || "default"}
            onChange={props.onAudioOutputChange}
          />
          </div>
        </div>
    );
  }
