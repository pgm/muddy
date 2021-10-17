import React, { useEffect } from "react";
import { Settings } from "./Settings";
import { Video, VideoStrip } from "./Video";
import {Track , JitsiTrack} from "./JitsiRoom";

interface LocalVideoProps {
    initialCameraDeviceId? : string
    initialaudioOutputDeviceId? : string
    initialMicDeviceId? : string
    setDefault? : (key : string, value : string | null | undefined) => void
    audioTrack? : JitsiTrack
    videoTrack? : JitsiTrack
    setAudioTrack : (track : JitsiTrack) => void
    setVideoTrack : (track : JitsiTrack) => void
    showDebugInfo?: boolean
  }
  
  declare namespace JitsiMeetJS {
    function init(opts : any) : any ;
    function setLogLevel (level : any) : void;
    let logLevels : any;
    function createLocalTracks(opts : any) : any ;
    let mediaDevices : any;
  };
  
  export const LocalVideo = (props: LocalVideoProps) => {
    const [loaded, setLoaded] = React.useState(false);
    const [cameraDeviceId, setCameraDeviceId] = React.useState< string| undefined>(props.initialCameraDeviceId);
    const [micDeviceId, setMicDeviceId] = React.useState< string| undefined>(props.initialMicDeviceId);
    const [audioOutputDeviceId, setAudioOutputDeviceId] = React.useState< string| undefined>(props.initialaudioOutputDeviceId);
    const [jitsiNeedsInit, setJitsiNeedsInit] = React.useState(true);
    const [mediaDevices, setMediaDevices] = React.useState<MediaDeviceInfo[] | null>(null);
    const [showSettings, setShowSettings] = React.useState(false);
    const [isMuted, setIsMuted] = React.useState(false);
    const {videoTrack, audioTrack} = props;
  
    useEffect( () => {
      if (jitsiNeedsInit) {
        JitsiMeetJS.init({});
        JitsiMeetJS.setLogLevel(JitsiMeetJS.logLevels.ERROR);
        JitsiMeetJS.mediaDevices.enumerateDevices((devices : MediaDeviceInfo[])=> {
          console.log("enumerateDevices result: ", devices);
          setMediaDevices(devices);
        })
        setJitsiNeedsInit(false);
      } }, [])
  
    useEffect( () => {
      console.log("checking if we've enumerated devices", mediaDevices)
      if(mediaDevices) {
        let camera = mediaDevices.find((e: any) =>  e.kind == "videoinput")?.deviceId;
        let mic = mediaDevices.find((e: any) =>  e.kind == "audioinput")?.deviceId;
        console.log("setting IDs", camera, mic);
        setCameraDeviceId(camera)
        setMicDeviceId(mic)
        }
    }, [mediaDevices] )
  
    useEffect( () => {
      if(props.setDefault) {
        props.setDefault("cameraDeviceId", cameraDeviceId)
      }
    }, [cameraDeviceId])
  
    useEffect( () => {
      if(props.setDefault) {
        props.setDefault("micDeviceId", micDeviceId)
      }
    }, [micDeviceId])
  
    // JitsiMeetJS.createLocalTracks({devices:["video", "audio"], cameraDeviceId: "9c97a548678941d762706aed9328c7be47d26443d1806c9650c8d172673e31ac"}).then((e) => {console.log("got"); console.log(e)} );
    useEffect( () => {
      if (cameraDeviceId) {
        console.log("creating local tracks")
        JitsiMeetJS.createLocalTracks({ devices: ["video"], cameraDeviceId: cameraDeviceId }).then(
          (tracks : any) => {
            console.log("created local video tracks", tracks);
            const _videoTrack = tracks.find((e: any) => e.type == "video");
            props.setVideoTrack(_videoTrack)
            setLoaded(true)
          }
        );    
      }
    }, [cameraDeviceId])

    useEffect( () => {
      if (micDeviceId) {
        console.log("creating local tracks")
        JitsiMeetJS.createLocalTracks({ devices: ["audio"], micDeviceId: micDeviceId }).then(
          (tracks : any) => {
            console.log("created local audio tracks", tracks);
            const _audioTrack = tracks.find((e: any) => e.type == "audio");
            props.setAudioTrack(_audioTrack)
            setLoaded(true)
          }
        );    
      }
    }, [micDeviceId])
  
  
    if (!loaded) {
      return <p>Loading</p>;
    } else {
      return (
        <div>
            {props.showDebugInfo &&
            <ul>
            <li>cameraDeviceId: {cameraDeviceId}</li>
            <li>micDeviceId: {micDeviceId}</li>
            <li>audioOutputDeviceId: {audioOutputDeviceId}</li>
            <li>mediaDevices: {mediaDevices && "mediaDevicesPopulated"}</li>
            </ul>
            }
          <Video label="You" videoTrack={videoTrack} showDebugInfo={props.showDebugInfo}/>
          {!showSettings && 
          <div className="video-controls">
              <button onClick={() => {setShowSettings(true)}}>Settings</button>
              {isMuted && <button onClick={() => {setIsMuted(false)}}>Unmute</button>}
              {!isMuted && <button onClick={() => {setIsMuted(true)}}>Mute</button>}
          </div>
          }
          { showSettings && mediaDevices &&
          <div className="settings-controls">
          <Settings
            videoInputDeviceId={cameraDeviceId}
            audioInputDeviceId={micDeviceId}
            audioOutputDeviceId={audioOutputDeviceId}
            deviceList={mediaDevices}
            onVideoInputChange={setCameraDeviceId}
            onAudioInputChange={setMicDeviceId}
            onAudioOutputChange={setAudioOutputDeviceId}
            /> 
            <div><button onClick={ () => {setShowSettings(false)}}>Close settings</button></div>
            </div>            
            }
        </div>
        );  
    }
  }
  
  