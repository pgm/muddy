import React from "react";
import { JitsiRoom, JitsiTrack, Track } from "./JitsiRoom";
import { LocalVideo } from "./LocalVideo";
import { Video } from "./Video";

export default {
  title: "Components/JitsiRoom",
  //component: JitsiRoom,
};

interface WrapperProps {
  serverURL : string
}

interface TrackPair {
  video?: JitsiTrack
  audio? : JitsiTrack
}

interface RemoteVideosProps {
  remoteTracks: Track[]
}

const RemoteVideos = (props: RemoteVideosProps) => {
  const remoteTracksByParticipant = new Map<string, TrackPair>();
  props.remoteTracks.forEach( (t) => {
    let pair = remoteTracksByParticipant.get(t.participantId)
    if (!pair) {
      pair = {video: undefined, audio: undefined}
      remoteTracksByParticipant.set(t.participantId, pair);
    }
    if(t.type == "video") {
      pair.video = t.track;
    } else if (t.type == "audio") {
      pair.audio = t.track;
    }
  })

  const participantIds = Array.from(remoteTracksByParticipant.keys())
  participantIds.sort()

  return (<div>
    {
   participantIds.map( (participantId, i) => {
    const tracks = remoteTracksByParticipant.get(participantId)
    console.log("partID", participantId, tracks);
    return <Video label={"video "+i} key={i} videoTrack={tracks?.video} audioTrack={tracks?.audio}/>
  }) } </div>);
}

function setDefaultInLocalStorage(key: string, value : string | null | undefined) {
  console.log("Todo: implement setDefaultInLocalStorage", key, value)
}

const Wrapper = (props: WrapperProps) => {
  // const [last, setLast] = React.useState("starting");
  const [videoTrack, setVideoTrack] = React.useState<JitsiTrack | undefined>(undefined);
  const [audioTrack, setAudioTrack] = React.useState<JitsiTrack | undefined>(undefined);

  const [remoteTracks, setRemoteTracks] = React.useState<JitsiTrack[]>([]);
  const [jitsi, setJitsi] = React.useState<JitsiRoom|null>(null)
  const [initialized, setIntialized] = React.useState(false);

  React.useEffect( () => {
    const jitsi = new JitsiRoom(props.serverURL)

    jitsi.on("roomTracksChanged", (tracks : JitsiTrack[]) => {
      const t = [...tracks];
      console.log("roomTracksChanged", t);
      setRemoteTracks(t);
    });

    // localFeed.on("videoChanged", (track) => {
    //   console.log("videoChanged", track);
    //   jitsi.setLocalVideoTrack(track);
    //   this.setState({ localVideo: track });
    // });

    // localFeed.on("audioChanged", (track) => {
    //   console.log("audioChanged", track);
    //   jitsi.setLocalAudioTrack(track);
    //   this.setState({ localAudio: track });
    // });

    // localFeed.initDevices().then(() => {
    //   console.log("initDevices complete");

    //   jitsi.connect("pgmtest").then(() => console.log("connect completed"));
    // });

    // const localFeed = new LocalFeed();
    // localFeed.on("devicesChanged", () => console.log("devicesChanged"));

    setJitsi(jitsi)
  }, [props.serverURL])

  React.useEffect( () => {
    console.log("setting setLocalAudioTrack setLocalVideoTrack", videoTrack, audioTrack)
    if(jitsi) { if ( audioTrack) {
      jitsi.setLocalAudioTrack(audioTrack)
    }
    if (videoTrack) {
      jitsi.setLocalVideoTrack(videoTrack)
    }
    if(audioTrack || videoTrack) {
      setIntialized(true)
    }
  }
  }, [videoTrack, audioTrack])

  React.useEffect( () => { 
    console.log("initialized", initialized)
    if(initialized) {
      jitsi?.connect("pgmtest").then( () => console.log("connect completed"))
    }
  }, [initialized] )

  return <div>
    <LocalVideo videoTrack={videoTrack} audioTrack={audioTrack} setAudioTrack={setAudioTrack} setVideoTrack={setVideoTrack} setDefault={ setDefaultInLocalStorage } />
    <div>{remoteTracks.length} Remotes</div>
    <RemoteVideos remoteTracks={remoteTracks}/>
  </div>

}


/**
 * Primary UI component for user interaction
 */
export const JitsiRoomTest = () => {
  return <Wrapper serverURL="beta.meet.jit.si"/>;
};
