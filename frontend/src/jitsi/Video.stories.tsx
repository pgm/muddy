import React, { useEffect } from "react";
import { Settings } from "./Settings";
import { Video, VideoStrip } from "./Video";

export default {
  title: "Components/Video",
  component: Video,
};

interface VideoWrapperProps {
  initialCameraDeviceId? : string
  initialaudioOutputDeviceId? : string
  initialMicDeviceId? : string
  setDefault : (key : string, value : string | null | undefined) => void
}

declare namespace JitsiMeetJS {
  function init(opts : any) : any ;
  function createLocalTracks(opts : any) : any ;
  let mediaDevices : any;
};

let VideoWrapper = (props: VideoWrapperProps) => {
  const [loaded, setLoaded] = React.useState(false);
  const [videoTrack, setVideoTrack] = React.useState(null);
  const [audioTrack, setAudioTrack] = React.useState(null);
  const [cameraDeviceId, setCameraDeviceId] = React.useState< string| null | undefined>(props.initialCameraDeviceId);
  const [micDeviceId, setMicDeviceId] = React.useState< string| null | undefined>(props.initialMicDeviceId);
  const [audioOutputDeviceId, setAudioOutputDeviceId] = React.useState< string| null | undefined>(props.initialaudioOutputDeviceId);
  const [jitsiNeedsInit, setJitsiNeedsInit] = React.useState(true);
  const [mediaDevices, setMediaDevices] = React.useState<MediaDeviceInfo[] | null>(null);

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
    if(mediaDevices) {
      let camera = mediaDevices.find((e: any) =>  e.kind == "videoinput")?.deviceId;
      let mic = mediaDevices.find((e: any) =>  e.kind == "audioinput")?.deviceId;
      console.log("setting IDs", camera, mic);
      setCameraDeviceId(camera)
      setMicDeviceId(mic)
      }
  }, [mediaDevices] )

  useEffect( () => {
    props.setDefault("cameraDeviceId", cameraDeviceId)
  }, [cameraDeviceId])

  useEffect( () => {
    props.setDefault("micDeviceId", micDeviceId)
  }, [micDeviceId])

  // JitsiMeetJS.createLocalTracks({devices:["video", "audio"], cameraDeviceId: "9c97a548678941d762706aed9328c7be47d26443d1806c9650c8d172673e31ac"}).then((e) => {console.log("got"); console.log(e)} );
  useEffect( () => {
    if (cameraDeviceId && micDeviceId) {
      props.setDefault("micDeviceId", micDeviceId)

      console.log("creating local tracks")
      JitsiMeetJS.createLocalTracks({ devices: ["video"], cameraDeviceId: cameraDeviceId, micDeviceId: micDeviceId }).then(
        (tracks : any) => {
          console.log("tracks", tracks);
          const _videoTrack = tracks.find((e: any) => e.type == "video");
          const _audioTrack = tracks.find((e: any) => e.type == "audio");
          setVideoTrack(_videoTrack)
          setAudioTrack(_audioTrack)
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
        {cameraDeviceId && micDeviceId && audioOutputDeviceId && mediaDevices &&
        <Settings
          videoInputDeviceId={cameraDeviceId}
          audioInputDeviceId={micDeviceId}
          audioOutputDeviceId={audioOutputDeviceId}
          deviceList={mediaDevices}
          onVideoInputChange={setCameraDeviceId}
          onAudioInputChange={setMicDeviceId}
          onAudioOutputChange={setAudioOutputDeviceId}
          
          /> }
        <VideoStrip videos={videos}>
          <div className="video-controls">
            <button>⚙️</button>
            <button>🎤</button>
          </div>
        </VideoStrip>
      </div>
      );  
  }
}

export const VideoStripDemo = () => {
  return <VideoWrapper setDefault= { (a, b) => { } }  ></VideoWrapper>;
};
