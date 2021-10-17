interface ConnectingState {
  state: "connecting";
}

interface DisconnectingState {
  state: "disconnecting";
}

interface SwitchingState {
  // switching rooms
  state: "switching";
  connection: JitsiConnection;
}

interface InRoomState {
  state: "inRoom";
  connection: JitsiConnection;
  activeRoom: JitsiConference;
}

interface DisconnectedState {
  state: "disconnected";
}

type RoomConnectionState =
  | ConnectingState
  | DisconnectedState
  | DisconnectingState
  | SwitchingState
  | InRoomState;

export class RoomConnection {
  // goal: api designed around setting a target room. The class will be eventually consistent. For updating react, it will a callback can be reigstered to
  // monitor whenever the tracks change. The UI only needs to render the latest state of the remote tracks

  // always availbe fields
  // targetRoom, localVideo, localAudio, onRemoteTrackersChange, remoteTracks, serverURL
  serverURL: string;
  targetRoom: string;
  localAudioTrack: JitsiTrack | null;
  localVideoTrack: JitsiTrack | null;
  onRoomTracksChanged: (tracks: Track[]) => void;
  remoteTracks: Track[];
  state: RoomConnectionState;

  constructor(
    serverURL: string,
    targetRoom: string,
    onRoomTracksChanged: (tracks: Track[]) => void
  ) {
    this.onRoomTracksChanged = onRoomTracksChanged;
    this.state = { state: "disconnected" };
    this.serverURL = serverURL;
    this.remoteTracks = [];
    this.localAudioTrack = null;
    this.localVideoTrack = null;
    this.targetRoom = targetRoom;
  }

  setLocalTrack(trackName: "localVideoTrack" | "localAudioTrack", track: JitsiTrack) {
    if (
      this.state.state == "disconnected" ||
      this.state.state == "connecting" ||
      this.state.state == "disconnecting"
    ) {
      this[trackName] = track;
    } else if (this.state.state == "switching") {
      console.log(
        "Warning: there is a race condition here. Should probably disallow switching video while switching rooms somehow."
      );
    } else if (this.state.state == "inRoom") {
      // need some mechanism to block switching rooms while this is going on... Otherwise we have a race condition
      const room = this.state.activeRoom;

      const add = () => {
        return room.addTrack(track).then(() => {
          this[trackName] = track;
        });
      };

      if (this[trackName]) {
        return room.removeTrack(this[trackName] as JitsiTrack).then(() => {
          this[trackName] = null;
          return add();
        });
      } else {
        return add();
      }
    }    
  }

  setLocalVideoTrack(track: JitsiTrack) {
    console.log("JitsiRoom setLocalVideoTrack", track);
    this.setLocalTrack("localVideoTrack", track)
  }

  setLocalAudioTrack(track: JitsiTrack) {
    console.log("JitsiRoom setLocalAudioTrack", track);
    this.setLocalTrack("localAudioTrack", track)
  }

  //🛏
  disconnect() {
    if (
      this.state.state == "disconnected" ||
      this.state.state == "disconnecting"
    ) {
      console.log("Disconnect called but nothing to do");
    } else if (this.state.state == "connecting") {
      console.log(
        "Warning: there is a race condition here. Should probably disallow disconnecting while switching rooms somehow or queue it for after the switch."
      );
    } else if (this.state.state == "switching") {
      console.log(
        "Warning: there is a race condition here. Should probably disallow disconnecting while switching rooms somehow or queue it for after the switch."
      );
      this.state.connection.disconnect();
    } else if (this.state.state == "inRoom") {
      const connection = this.state.connection;
      const activeRoom = this.state.activeRoom;

      this.state = { state: "disconnecting" };

      return activeRoom.leave().then(() => {
        connection.disconnect();
      });
    }
  }

  setRoom(roomId: string) {
    if (
      this.state.state == "disconnected" ||
      this.state.state == "disconnecting" ||
      this.state.state == "connecting" ||
      this.state.state == "switching"
    ) {
      this.targetRoom = roomId;
    } else if (this.state.state == "inRoom") {
      const connection = this.state.connection;
      const activeRoom = this.state.activeRoom;

      this.state = { state: "switching", connection: connection };
      this.targetRoom = roomId;

      return activeRoom.leave().then(() => {
        return this.unsafeJoinTargetRoom(connection);
      });
    }
  }

  connect() {
    console.log("starting connect");
    this.state = { state: "connecting" };
    // MITTEN IS GOING TO BED YOU MUST FIND HER BEDTIME CARROT,HER BED AND HER STUFFED ANIMAL!!!!!
    return jitsiConnect().then((connection) => {
      return this.unsafeJoinTargetRoom(connection);
    });
  }

  unsafeJoinTargetRoom(connection: JitsiConnection) {
    console.log("unsafeJoinTargetRoom")
    const roomId = this.targetRoom;

    const roomTrackAdded = (track: JitsiTrack) => {
      console.log(`roomTrackAdded called`);
      if (track.isLocal() === true) {
        return;
      }
      let newTrackId = track.getId();
      let matchTrack = this.remoteTracks.find((t) => t.id == newTrackId);
      if (matchTrack) {
        return;
      }
      let trackInfo: Track = {
        id: newTrackId,
        participantId: track.getParticipantId(),
        type: track.getType(),
        track: track,
      };
      this.remoteTracks.push(trackInfo);

      this.fireOnRoomTracksChanged();
    };

    const roomTrackRemoved = (track: JitsiTrack) => {
      console.log(`roomTrackRemoved called`);
      if (track.isLocal() === true) {
        return;
      }
      let trackId = track.getId();
      this.remoteTracks = this.remoteTracks.filter((t) => t.id != trackId);

      this.fireOnRoomTracksChanged();
    };

    // this is "unsafe because it does not unjoin any existing rooms before joining the target"
    console.log("calling initJitsiConference", roomId)
    const newRoom = connection.initJitsiConference(roomId, {
      openBridgeChannel: true,
    });

    newRoom.addEventListener(
      JitsiMeetJS.events.conference.TRACK_ADDED,
      roomTrackAdded
    );

    newRoom.addEventListener(
      JitsiMeetJS.events.conference.TRACK_REMOVED,
      roomTrackRemoved
    );

    const joinedPromise = new Promise<void>((resolve, reject) => {
      newRoom.addEventListener(
        JitsiMeetJS.events.conference.CONFERENCE_JOINED,
        () => {
          console.log(`CONFERENCE_JOINED called`);
          resolve();
        }
      );
    });

    console.log("calling join()")
    newRoom.join();

    return joinedPromise
      .then(() => {
        console.log("joined promise complete. Adding tracks...");

        const blockers: Promise<any>[] = [];
        if (this.localVideoTrack) {
          console.log("adding local video");
          blockers.push(newRoom.addTrack(this.localVideoTrack));
        }

        if (this.localAudioTrack) {
          console.log("adding local audio");

          blockers.push(newRoom.addTrack(this.localAudioTrack));
        }

        return Promise.all(blockers);
      })
      .then(() => {
        console.log("everything done. Updating state")
        this.state = {
          state: "inRoom",
          connection: connection,
          activeRoom: newRoom,
        };
      });
  }

  fireOnRoomTracksChanged() {
    this.onRoomTracksChanged([...this.remoteTracks]);
  }
}

function jitsiConnect(): Promise<JitsiConnection> {
  const connection = new JitsiMeetJS.JitsiConnection(null, null, {
    hosts: {
      domain: "rain.hashslash.dev",
      muc: `conference.rain.hashslash.dev`, // FIXME: use XEP-0030
    },
    //  serviceUrl: `wss://${this.serverURL}/xmpp-websocket?room=${roomId}`,
    // serviceURL: `https://rain.hashslash.dev/http-bind?room=${roomId}`,
    // clientNode: `https://rain.hashslash.dev`,
    bosh: "https://rain.hashslash.dev/http-bind",
  });

  console.log("outside promise");
  const promise = new Promise<JitsiConnection>((resolve, reject) => {
    console.log("inside promise");
    const onConnectionSuccess = () => {
      console.log("onConnectionSuccess");
      resolve(connection);
    };

    const onConnectionFailed = (a: any, b: any, c: any, d: any) => {
      console.log("onConnectionFailed");
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

//
// states
//   connecting:
//      none
//
//   disconnecting:
//      none
//
//   switchingRooms:
//      connection
//
//   inRoom:
//      activeRoom
//      connection
//
//    disconnected
//      none
//
// transitions:
//   connecting -> inRoom
//   inRoom -> switchingRooms
//   switchingRooms -> inRoom
//   switchingRooms -> switchingRoom (if target changes during unjoin/join)
//   inRoom -> disconnecting
//   switchingRooms -> disconnecting
//   disconnecting -> disconnected
//   connecting -> disconnected
//
// methods:
//   new(server, onRemoteTrackersChange)
//   setLocalVideo
//   setLocalAudio
//   connect()
//   disconnect()
//   setRoom()
//🥕

interface JitsiConnectionConstructor {
  new (appID: any, token: any, options: any): JitsiConnection;
}

declare namespace JitsiMeetJS {
  let events: any;
  let JitsiConnection: JitsiConnectionConstructor;
}

export interface Track {
  id: string;
  participantId: string;
  type: string;
  track: JitsiTrack;
}

export interface JitsiTrack {
  isLocal: () => boolean;

  // getType() - returns string with the type of the track( "video" for the video tracks and "audio" for the audio tracks)
  getType(): string;

  // mute() - mutes the track. Returns Promise.
  // Note: This method is implemented only for the local tracks.
  mute(): Promise<unknown>;

  //  unmute() - unmutes the track. Returns Promise.
  // Note: This method is implemented only for the local tracks.
  unmute(): Promise<unknown>;

  isMuted(): boolean; // - check if track is muted

  attach(container: any): void; // - attaches the track to the given container.

  detach(container: any): void; // - removes the track from the container.

  dispose(): Promise<unknown>; // - disposes the track. If the track is added to a conference the track will be removed. Returns Promise.
  //  Note: This method is implemented only for the local tracks.

  getId(): string; //- returns unique string for the track.

  getParticipantId(): string; // - returns id(string) of the track owner
  // Note: This method is implemented only for the remote tracks.

  setAudioOutput(audioOutputDeviceId: string): void; // - sets new audio output device for track's DOM elements. Video tracks are ignored.

  getDeviceId(): string; // - returns device ID associated with track (for local tracks only)

  isEnded(): boolean; // - returns true if track is ended

  //- Applies the effect by swapping out the existing MediaStream on the JitsiTrack with the new
  // MediaStream which has the desired effect. "undefined" is passed to this function for removing the effect and for
  //restoring the original MediaStream on the JitsiTrack.
  //  Note: This method is implemented only for the local tracks.

  setEffect(effect: JitsiEffect): void;
}

export interface JitsiEffect {
  // The following methods have to be defined for the effect instance.

  startEffect(): MediaStream; // - Starts the effect and returns a new MediaStream that is to be swapped with the existing one.

  stopEffect(): void; // - Stops the effect.

  isEnabled(): boolean; // - Checks if the local track supports the effect.
}

export interface JitsiConference {
  leave: () => Promise<void>;
  addEventListener: (event: string, handler: any) => void;
  removeEventListener: (event: string, handler: any) => void;
  addTrack: (track: JitsiTrack) => Promise<any>;
  removeTrack: (track: JitsiTrack) => Promise<any>;
  join: () => void;
}

export interface JitsiConnection {
  disconnect: () => void;
  initJitsiConference: (roomId: string, options: any) => JitsiConference;
  addEventListener: (event: string, handler: any) => void;
  connect: () => void;
  //🧸
}
