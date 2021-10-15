import React from "react";
import "./Video.css";
import {JitsiTrack} from "./JitsiRoom";

interface VideoStripProps {
  children : any;
  videos: VideoProps[];
}

export function VideoStrip (props : VideoStripProps) {
  return (
    <div className="video-strip">
      {props.children}
      {props.videos.map((video, i) => (
        <Video
          key={i}
          videoTrack={video.videoTrack}
          audioTrack={video.audioTrack}
          label={video.label}
        />
      ))}
    </div>
  );
}

interface VideoProps {
  label :string;
  videoTrack?: JitsiTrack;
  audioTrack?: JitsiTrack;
}

// props: videoTrack, audioTrack
export function Video (props: VideoProps) {
  const { label, videoTrack, audioTrack } = props;

  let videoRef = React.useRef(null);
  let audioRef = React.useRef(null);

  React.useEffect( () => {
    if (audioTrack) {
      audioTrack.attach(audioRef.current);
      console.log("Attaching audio 1");
    }

    return () => {
          if (audioTrack) {
      audioTrack.detach(audioRef.current);
    }
    }
  }, [audioTrack])

  React.useEffect( () => {
    if (videoTrack) {
      videoTrack.attach(videoRef.current);
      console.log("Attaching video 1");
    }
    return () => {
      if (videoTrack) {
        videoTrack.detach(videoRef.current);
      }
    }
  }, [videoTrack])

  return (
    <div className="video-block">
      { videoTrack && <div>has video</div>}
      { audioRef && <div>has audio</div>}
      <video autoPlay={true} ref={videoRef} />
      <span>{label}</span>
      <audio autoPlay={true} ref={audioRef} />
    </div>
  );
}
