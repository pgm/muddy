import React, { useEffect } from "react";
import { Settings } from "./Settings";
import { Video, VideoStrip } from "./Video";
import {Track } from "./JitsiRoom";

interface LocalVideoProps {
    initialCameraDeviceId? : string
    initialaudioOutputDeviceId? : string
    initialMicDeviceId? : string
    setDefault? : (key : string, value : string | null | undefined) => void
    audioTrack? : Track
    videoTrack? : Track
    setAudioTrack : (track : Track) => void
    setVideoTrack : (track : Track) => void
  }
  
  declare namespace JitsiMeetJS {
    function init(opts : any) : any ;
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
    const {videoTrack, audioTrack} = props;
  
    useEffect( () => {
      if (jitsiNeedsInit) {
        JitsiMeetJS.init({});
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
      if (cameraDeviceId && micDeviceId) {
        if(props.setDefault) {
          props.setDefault("micDeviceId", micDeviceId)
        }
  
        console.log("creating local tracks")
        JitsiMeetJS.createLocalTracks({ devices: ["video"], cameraDeviceId: cameraDeviceId, micDeviceId: micDeviceId }).then(
          (tracks : any) => {
            console.log("tracks", tracks);
            const _videoTrack = tracks.find((e: any) => e.type == "video");
            const _audioTrack = tracks.find((e: any) => e.type == "audio");
            props.setVideoTrack(_videoTrack)
            props.setAudioTrack(_audioTrack)
            setLoaded(true)
          }
        );    
      }
    }, [cameraDeviceId, micDeviceId])
  
  
    if (!loaded) {
      return <p>Loading</p>;
    } else {
      const videos = [
        { videoTrack: videoTrack, label: "Frank" },
        { videoTrack: videoTrack, label: "Steve" },
        { videoTrack: videoTrack, label: "Mary" },
      ];
      return (
        <div>
            <ul>
            <li>cameraDeviceId: {cameraDeviceId}</li>
            <li>micDeviceId: {micDeviceId}</li>
            <li>audioOutputDeviceId: {audioOutputDeviceId}</li>
            <li>mediaDevices: {mediaDevices && "mediaDevicesPopulated"}</li>
            </ul>
          {cameraDeviceId && micDeviceId && /* audioOutputDeviceId && */ mediaDevices &&
          <Settings
            videoInputDeviceId={cameraDeviceId}
            audioInputDeviceId={micDeviceId}
            audioOutputDeviceId={audioOutputDeviceId}
            deviceList={mediaDevices}
            onVideoInputChange={setCameraDeviceId}
            onAudioInputChange={setMicDeviceId}
            onAudioOutputChange={setAudioOutputDeviceId}
            /> }
            <div className="video-controls">
              <button>⚙️</button>
              <button>🎤</button>
            </div>
          <Video label="You" videoTrack={videoTrack} />
        </div>
        );  
    }
  }
  
  