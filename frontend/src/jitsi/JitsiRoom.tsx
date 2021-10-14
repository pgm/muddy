// export class LocalFeed {
//   constructor() {
//     this.selectedInputAudioDeviceId = null;
//     this.selectedInputVideoDeviceId = null;
//     this.localTracks = [];
//     this.audioInputDevices = [];
//     this.videoInputDevices = [];
//     this.audioOutputDevices = [];
//     this.listeners = {};
//   }

//   on(event, callback) {
//     const listeners = this.listeners[event] || [];
//     listeners.push(callback);
//     this.listeners[event] = listeners;
//   }

//   fire(event, params) {
//     const listeners = this.listeners[event] || [];
//     listeners.forEach((l) => l(params));
//   }

//   selectVideo(deviceId) {
//     this.selectedInputVideoDeviceId = deviceId;
//     this.createLocalTracks();
//   }

//   selectAudio(deviceId) {
//     this.selectedInputAudioDeviceId = deviceId;
//     this.createLocalTracks();
//   }

//   enumerateDevices() {
//     const promise = new Promise((resolve, reject) => {
//       JitsiMeetJS.mediaDevices.enumerateDevices((devices) => {
//         resolve(devices);
//         this.fire("devicesChanged");
//       });
//     });

//     return promise;
//   }

//   createLocalTracks() {
//     return JitsiMeetJS.createLocalTracks({
//       devices: ["audio", "video"],
//       micDeviceId: this.selectedInputAudioDeviceId,
//       cameraDeviceId: this.selectedInputVideoDeviceId,
//     }).then((tracks) => {
//       this.localTracks = tracks;
//       const videoTrack = _.find(tracks, (track) => track.getType() == "video");
//       const audioTrack = _.find(tracks, (track) => track.getType() == "audio");
//       this.fire("audioChanged", audioTrack);
//       this.fire("videoChanged", videoTrack);
//     });
//   }

//   initDevices() {
//     const getDevicesPromise = this.enumerateDevices().then((devices) => {
//       this.audioInputDevices = _.filter(devices, { kind: "audioinput" });
//       this.videoInputDevices = _.filter(devices, { kind: "videoinput" });
//       this.audioOutputDevices = _.filter(devices, { kind: "audiooutput" });

//       if (this.audioInputDevices.length > 0) {
//         this.selectedInputAudioDeviceId = this.audioInputDevices[0].deviceId;
//       }

//       if (this.videoInputDevices.length > 0) {
//         this.selectedInputVideoDeviceId = this.videoInputDevices[0].deviceId;
//       }

//       console.log("initDevs", this);
//     });

//     const getTracksPromise = this.createLocalTracks();

//     return Promise.all([getDevicesPromise, getTracksPromise]);
//   }
// }

interface JitsiConnectionConstructor {
  new (appID: any, token: any, options : any) : JitsiConnection
}

declare namespace JitsiMeetJS {
  let events : any
  let JitsiConnection : JitsiConnectionConstructor
}

export interface Track {
  id: string
  participantId: string
  type: string
  track: JitsiTrack
}

interface JitsiTrack {
  isLocal : () => boolean
  getId : () => string
  getParticipantId : () => string
  getType : () => string
}

interface JitsiConference {
  leave : () => Promise<void>
  addEventListener : (event: string, handler: any) => void
  removeEventListener : (event : string, handler: any) => void
  addTrack : (track: Track) => Promise<any>
  removeTrack : (track: Track) => Promise<any>
  join : () => void
}

interface JitsiConnection {
  disconnect : () => void
  initJitsiConference : (roomId : string, options: any) => JitsiConference
  addEventListener: (event: string, handler: any) => void
  connect : () => void
}

// interface JitsiRoomVideoProps {
//   remoteTracks : Track[]
// }

// export const JitsiRoomVideo = (props : JitsiRoomVideoProps) {
  
// }

export class JitsiRoom {
  serverURL : string;
  listeners : Map<string, ((params: any)=>void)[]>;
  onRoomTracksChanged: (()=>void )[];
  remoteTracks : Track[];
  activeRoom: JitsiConference | null
  localAudioTrack : Track | null
  localVideoTrack : Track | null
  connection : JitsiConnection | null

  constructor(serverURL : string) {
    this.serverURL = serverURL;
    this.connection = null;
    this.remoteTracks = [];
    this.onRoomTracksChanged = [];
    this.activeRoom = null;
    this.localAudioTrack = null;
    this.localVideoTrack = null;
    this.listeners = new Map()
  }

  on(event : string, callback : any) {
    const listeners = this.listeners.get(event) || [];
    listeners.push(callback);
    this.listeners.set(event, listeners);
  }

  fire(event : string, params : any) {
    const listeners = this.listeners.get(event) || [];
    listeners.forEach( ( l) => l(params) );
  }

  setLocalVideoTrack(track : Track) {
    if (this.activeRoom) {
      const room = this.activeRoom;
      const add = () => {
        return room.addTrack(track).then(() => {
          this.localVideoTrack = track;
        });
      };
      if (this.localVideoTrack) {
        return room.removeTrack(this.localVideoTrack).then(() => {
          this.localVideoTrack = null;
          add();
        });
      } else {
        return add();
      }
    } else {
      this.localVideoTrack = track;
      return Promise.resolve();
    }
  }

  setLocalAudioTrack(track : Track) {
    console.log("ignoring onSetLocalAudioTrack", track);
  }

  disconnect() {
    const closeConnection = () => {
      if (this.connection) {
        this.connection.disconnect();
      }
    };

    if (this.activeRoom) {
      return this.activeRoom.leave().then(closeConnection);
    } else {
      closeConnection();
    }
  }

  unsafeJoinRoom(connection : JitsiConnection, roomId : string) {
    let room = connection.initJitsiConference(roomId, {
      openBridgeChannel: true,
    });

    this.activeRoom = room;

    room.addEventListener(
      JitsiMeetJS.events.conference.TRACK_ADDED,
      this.roomTrackAdded
    );

    room.addEventListener(
      JitsiMeetJS.events.conference.TRACK_REMOVED,
      this.roomTrackRemoved
    );

    console.log("localvideo", this.localVideoTrack);
    if (this.localVideoTrack) {
      console.log("adding local video");
      room.addTrack(this.localVideoTrack);
    }

    if (this.localAudioTrack) {
      console.log("adding local audio");

      room.addTrack(this.localAudioTrack);
    }

    room.join();
  }

  setRoom(roomId : string) {
    // change room by first leaving the current room and then joining the new one
    if(this.activeRoom && this.connection) {
      let connection = this.connection;
      this.activeRoom.leave().then(() => {
        this.unsafeJoinRoom(connection, roomId);
      });
    }
  }

  connect(roomId : string) {
    console.log("starting connect to ", roomId);
    let connection = new JitsiMeetJS.JitsiConnection(null, null, {
      hosts: {
        domain: this.serverURL,
        muc: `conference.${this.serverURL}`, // FIXME: use XEP-0030
      },
      serviceUrl: `wss://${this.serverURL}/xmpp-websocket?room=${roomId}`,
      clientNode: `https://${this.serverURL}`,
    });

    this.connection = connection;

    console.log("outside promise");
    const promise = new Promise<void>((resolve, reject) => {
      console.log("inside promise");
      const onConnectionSuccess = () => {
        console.log("initJitsiConference");
        this.unsafeJoinRoom(connection, roomId);

        console.log("resolve");
        resolve();
      };

      const onConnectionFailed = (a : any, b : any, c : any, d : any) => {
        reject(a);
      };

      connection.addEventListener(
        JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED,
        onConnectionSuccess
      );

      connection.addEventListener(
        JitsiMeetJS.events.connection.CONNECTION_FAILED,
        onConnectionFailed
      );
    });

    const onConnectionDisconnect = () => {
      console.log("disconnected");
    };

    connection.addEventListener(
      JitsiMeetJS.events.connection.CONNECTION_DISCONNECTED,
      onConnectionDisconnect
    );
    connection.connect();

    return promise;
  }

  roomTrackAdded = (track : JitsiTrack) => {
    if (track.isLocal() === true) {
      return;
    }
    let newTrackId = track.getId();
    console.log(`Track Added: ${newTrackId}`);
    let matchTrack = this.remoteTracks.find( (t) => t.id == newTrackId );
    if (matchTrack) {
      return;
    }
    let trackInfo : Track = {
      id: newTrackId,
      participantId: track.getParticipantId(),
      type: track.getType(),
      track: track,
    };
    this.remoteTracks.push(trackInfo);

    this.fire("roomTracksChanged", this.remoteTracks);
  };

  roomTrackRemoved = (track : JitsiTrack) => {
    if (track.isLocal() === true) {
      return;
    }
    let trackId = track.getId();
    this.remoteTracks = this.remoteTracks.filter( (t) => t.id != trackId );

    this.fire("roomTracksChanged", this.remoteTracks);
  };
}
