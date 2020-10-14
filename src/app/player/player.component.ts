import { Component, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import * as io from 'socket.io-client';
import { ChatService } from '../chat.service';
const { RTCPeerConnection, RTCSessionDescription } = window;
const peerConnection = new RTCPeerConnection();
const mediaD = navigator.mediaDevices as any;
declare var MediaRecorder: any;
// declare var MultiStreamRecorder: any;

@Component({
  selector: 'app-player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.css'],
  providers: [ChatService]
})
export class PlayerComponent implements OnInit, AfterViewInit {
  @ViewChild("recorderVideo") recorderVideo: ElementRef;
  private socket = io.connect("localhost:7000");
  public isAlreadyCalling = false;
  public getCalled = false;
  mediaRecorder: any;
  screenRecorder: any;
  displayMediaStream: any;
  _recorderVideo: any;
  public existingCalls = [];
  recorderedVideo = [];
  public senders = [];

  recordingOptions = {
    mimetype: "video/webm",
    audioBitsPerSecond: 128000,
    videoBitsPerSecond: 250000
  };

  user: String;
  room: '131921';
  messageText: String;
  messageArray: Array<{ user: String, message: String }> = [];
  constructor(private _chatService: ChatService) { 
    this._chatService.newUserJoined()
    .subscribe(data => this.messageArray.push(data));


  this._chatService.userLeftRoom()
    .subscribe(data => this.messageArray.push(data));

  this._chatService.newMessageReceived()
    .subscribe(data => this.messageArray.push(data));
  }

  ngOnInit(): void {
    this.startLocalStreaming();
    this.socket.on("update-user-list", ({ users }) => {
      this.updateUserList(users);
    });

    this.socket.on("remove-user", ({ socketId }) => {
      const elToRemove = document.getElementById(socketId);

      if (elToRemove) {
        elToRemove.remove();
      }
    });

    this.socket.on("call-made", async data => {
      if (this.getCalled) {
        const confirmed = confirm(
          `User "Socket: ${data.socket}" wants to call you. Do accept this call?`
        );

        if (!confirmed) {
          this.socket.emit("reject-call", {
            from: data.socket
          });

          return;
        }
      }

      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.offer)
      );
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(new RTCSessionDescription(answer));

      this.socket.emit("make-answer", {
        answer,
        to: data.socket
      });
      this.getCalled = true;
    });

    this.socket.on("answer-made", async data => {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.answer)
      );

      if (!this.isAlreadyCalling) {
        this.callUser(data.socket);
        this.isAlreadyCalling = true;
      }
    });

    this.socket.on("call-rejected", data => {
      this.unselectUsersFromList();
    });

    peerConnection.ontrack = ({ streams: [stream] }) => {
      const remoteVideo = document.getElementById("remote-video");
      if (remoteVideo) {
        remoteVideo['srcObject'] = stream;
        // this.startRecording(stream);
      }
    };

    this.room = '131921';
    this.join();
  }

  ngAfterViewInit() {
    this._recorderVideo = this.recorderVideo.nativeElement;
  }


  unselectUsersFromList() {
    const alreadySelectedUser = document.querySelectorAll(
      ".active-user.active-user--selected"
    );

    alreadySelectedUser.forEach(el => {
      el.setAttribute("class", "active-user");
    });
  }

  createUserItemContainer(socketId) {
    const userContainerEl = document.createElement("div");

    const usernameEl = document.createElement("p");

    userContainerEl.setAttribute("class", "active-user");
    userContainerEl.setAttribute("id", socketId);
    usernameEl.setAttribute("class", "username");
    usernameEl.innerHTML = `Socket: ${socketId}`;

    userContainerEl.appendChild(usernameEl);

    userContainerEl.addEventListener("click", () => {
      this.unselectUsersFromList();
      userContainerEl.setAttribute("class", "active-user active-user--selected");
      const talkingWithInfo = document.getElementById("talking-with-info");
      talkingWithInfo.innerHTML = `Talking with: "Socket: ${socketId}"`;
      this.callUser(socketId);
    });

    return userContainerEl;
  }

  async callUser(socketId) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(new RTCSessionDescription(offer));

    this.socket.emit("call-user", {
      offer,
      to: socketId
    });
  }

  updateUserList(socketIds) {
    console.log("socketIds");
    const activeUserContainer = document.getElementById("active-user-container");

    socketIds.forEach(socketId => {
      const alreadyExistingUser = document.getElementById(socketId);
      if (!alreadyExistingUser) {
        const userContainerEl = this.createUserItemContainer(socketId);

        activeUserContainer.appendChild(userContainerEl);
      }
    });
  }


  startLocalStreaming() {
    let options = { mimeType: "video/webm; codecs=vp9" };
    navigator.getUserMedia(
      { video: true, audio: true },
      stream => {
        const localVideo = document.getElementById("local-video");
        if (localVideo) {
          (<any>window).stream = stream;
          localVideo['srcObject'] = stream;
          this.startRecording(stream);
          // this.mediaRecorder = new MediaRecorder((<any>window).stream, options);
          // this.mediaRecorder.ondataavailable = ({ data }) => {
          //   if (data.size > 0) {
          //     this.recorderedVideo.push(data);
          //     // console.log("tt",this.recorderedVideo);
          //   }
          // };
          // this.mediaRecorder.start(10);
        }
        stream.getTracks().forEach(track => this.senders.push(peerConnection.addTrack(track, stream)));
      },
      error => {
        console.warn(error.message);
      }
    );
  }

  async shareScreen() {
    if (!this.displayMediaStream) {
      this.displayMediaStream = await mediaD.getDisplayMedia({ video: true, audio: true });
    }
    (<any>window).screen = this.displayMediaStream;
    this.senders.find(sender => sender.track.kind === 'video').replaceTrack(this.displayMediaStream.getTracks()[0]);
    const localVideo = document.getElementById("local-video");
    localVideo['srcObject'] = this.displayMediaStream;
    (<any>window).stream.getTracks().forEach(track => {
      track.stop();
    });


    // let options = { mimeType: "video/webm" };
    // this.screenRecorder = new MediaRecorder(this.displayMediaStream, options);
    // this.screenRecorder.onstop = event => {
    //   console.log("Recorderscreen Stop: ", event);
    // };
    // this.screenRecorder.ondataavailable = ({ data }) => {
    //   if (data.size > 0) {
    //     this.recorderedVideo.push(data);
    //     console.log("tttty", this.recorderedVideo);
    //     // console.log(this.recorderedVideo);
    //   }
    // };
    // this.screenRecorder.start(10);




  }

  stopCameraCapture() {
    (<any>window).stream.getTracks().forEach(track => {
      track.stop();
    });
    this.mediaRecorder.stop();
  }

  async stopScreen() {
    this.senders.find(sender => sender.track.kind === 'video')
      .replaceTrack((<any>window).stream.getTracks().find(track => track.kind === 'video'));
    const localVideo = document.getElementById("local-video");
    localVideo['srcObject'] = (<any>window).stream;
    // this.screenRecorder.stop();

    // var videoBlob = new Blob(this.recorderedVideo, { type: "video/webm" });
    // console.log("vb", videoBlob)
    // console.log("tt", window.URL.createObjectURL(videoBlob));
    // this._recorderVideo['src'] = window.URL.createObjectURL(videoBlob);
  }

  startRecording(st) {
    // var multiStreamRecorder = new MultiStreamRecorder(this.senders);
    // multiStreamRecorder.ondataavailable = function(blob) {
    //   this.recorderedVideo.push(blob);
      // var blobURL = URL.createObjectURL(blob);
      // document.write('<a href="' + blobURL + '">' + blobURL + '</a>');
  // };
  // multiStreamRecorder.start(3000);
  let options = { mimeType: "video/webm" };
  const stream = new MediaStream((<any>window).stream);
    this.mediaRecorder = new MediaRecorder(stream, options);
    this.mediaRecorder.onstop = event => {
      console.log("Recorder Stop: ", event);
    };
    this.mediaRecorder.ondataavailable = ({ data }) => {
      if (data.size > 0) {
        this.recorderedVideo.push(data);
        console.log("tt", this.recorderedVideo);
        // console.log(this.recorderedVideo);
      }
    };
    this.mediaRecorder.start(10);
    // console.log("Started Recording video", this.mediaRecorder);
  }

  stopRecording() {
      (<any>window).stream.getTracks().forEach(function(track) {
        if (track.readyState == 'live') {
            track.stop();
        }
    });
    // (<any>window).stream.getTracks().forEach(track => {
    //   track.stop();
    // });
    // this.mediaRecorder.stop();
    // console.log("tt",this.senders);
    var videoBlob = new Blob(this.recorderedVideo, { type: "video/webm" });
    console.log("vb", videoBlob)
    console.log("tt", window.URL.createObjectURL(videoBlob));
    this._recorderVideo['src'] = window.URL.createObjectURL(videoBlob);
  }


  join() {
    this._chatService.joinRoom({ user: 'Aman', room: this.room });
  }

  leave() {
    this._chatService.leaveRoom({ user: 'Aman', room: this.room });
  }

  sendMessage() {
    this._chatService.sendMessage({ user: 'Aman', room: this.room, message: this.messageText });
  }


}
