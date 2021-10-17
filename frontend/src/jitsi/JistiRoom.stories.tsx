import React from "react";
import { RoomConnection, JitsiTrack, Track } from "./JitsiRoom";
import { LocalVideo } from "./LocalVideo";
import { Video } from "./Video";

export default {
  title: "Components/JitsiRoom",
  //component: JitsiRoom,
};

interface WrapperProps {
  serverURL: string;
  showDebugInfo? : boolean;
}

interface TrackPair {
  video?: JitsiTrack;
  audio?: JitsiTrack;
}

interface RemoteVideosProps {
  remoteTracks: Track[];
  showDebugInfo?: boolean
}

const RemoteVideos = (props: RemoteVideosProps) => {
  const remoteTracksByParticipant = new Map<string, TrackPair>();
  props.remoteTracks.forEach((t) => {
    let pair = remoteTracksByParticipant.get(t.participantId);
    if (!pair) {
      pair = { video: undefined, audio: undefined };
      remoteTracksByParticipant.set(t.participantId, pair);
    }
    if (t.type === "video") {
      pair.video = t.track;
    } else if (t.type === "audio") {
      pair.audio = t.track;
    }
  });

  const participantIds = Array.from(remoteTracksByParticipant.keys());
  participantIds.sort();

  return (
    <div>
      {participantIds.map((participantId, i) => {
        const tracks = remoteTracksByParticipant.get(participantId);
        console.log("partID", participantId, tracks);
        return (
          <Video
            label={"video " + i}
            key={i}
            videoTrack={tracks?.video}
            audioTrack={tracks?.audio}
            showDebugInfo={props.showDebugInfo}
          />
        );
      })}{" "}
    </div>
  );
};

function setDefaultInLocalStorage(
  key: string,
  value: string | null | undefined
) {
  console.log("Todo: implement setDefaultInLocalStorage", key, value);
}

const Wrapper = (props: WrapperProps) => {
  // const [last, setLast] = React.useState("starting");
  const [room, setRoom] = React.useState("room1");
  const [videoTrack, setVideoTrack] = React.useState<JitsiTrack | undefined>(
    undefined
  );
  const [audioTrack, setAudioTrack] = React.useState<JitsiTrack | undefined>(
    undefined
  );

  const [remoteTracks, setRemoteTracks] = React.useState<Track[]>([]);
  const [jitsi, setJitsi] = React.useState<RoomConnection | null>(null);
  const [initialized, setIntialized] = React.useState(false);

  React.useEffect(() => {
    const jitsi = new RoomConnection(
      props.serverURL,
      "",
      (tracks: Track[]) => {
        console.log("roomTracksChanged", tracks);
        setRemoteTracks(tracks);
      }
    );
    setJitsi(jitsi);
  }, [props.serverURL]);

  React.useEffect( () => {
    jitsi?.setRoom(room)
  }, [jitsi, room])

  React.useEffect(() => {
    console.log(
      "useEffect: calling setLocalAudioTrack setLocalVideoTrack",
      videoTrack,
      audioTrack
    );
    if (jitsi) {
      if (audioTrack) {
        console.log("has audiotrack")
        jitsi.setLocalAudioTrack(audioTrack);
      } else {
        console.log("no audiotrack set")
      }
      if (videoTrack) {
        jitsi.setLocalVideoTrack(videoTrack);
      }
      if (audioTrack || videoTrack) {
        setIntialized(true);
      }
    }
  }, [jitsi, videoTrack, audioTrack]);

  React.useEffect(() => {
    console.log("initialized", initialized);
    if (initialized) {
      jitsi?.connect().then(() => console.log("connect fully completed"));
    }
  }, [jitsi, initialized]);

  return (
    <div>
      <select value={room} onChange={(e) => {setRoom(e.target.value)}}>
      <option id="room1">room1</option>
      <option id="room2">room2</option>
      <option id="room3">room3</option>
        </select>
      <LocalVideo
        initialCameraDeviceId="default"
        videoTrack={videoTrack}
        audioTrack={audioTrack}
        setAudioTrack={setAudioTrack}
        setVideoTrack={setVideoTrack}
        setDefault={setDefaultInLocalStorage}
        showDebugInfo={props.showDebugInfo}
      />
      <RemoteVideos remoteTracks={remoteTracks}         showDebugInfo={props.showDebugInfo}
/>
    </div>
  );
};

/**
 * Primary UI component for user interaction
 */
export const JitsiRoomTest = () => {
  return <div style={ {width: "200px"} }><Wrapper  showDebugInfo={true} serverURL="beta.meet.jit.si" /></div>;
};
