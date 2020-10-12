import { Component, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import * as io from 'socket.io-client';
const { RTCPeerConnection, RTCSessionDescription } = window;
const peerConnection = new RTCPeerConnection();
const mediaD = navigator.mediaDevices as any;
declare var MediaRecorder: any;

@Component({
  selector: 'app-player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.css']
})
export class PlayerComponent implements OnInit,AfterViewInit {
  @ViewChild("remVideo") recorderVideo: ElementRef;
  private socket = io.connect("localhost:7000");
  public isAlreadyCalling = false;
  public getCalled = false;
  mediaRecorder: any;
  _recorderVideo: any;
  public existingCalls = [];
  recorderedVideo = [];
  recordingOptions = {
    mimetype: "video/webm",
    audioBitsPerSecond: 128000,
    videoBitsPerSecond: 250000
  };
  constructor() { }

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

    peerConnection.ontrack =  ({ streams: [stream] })=> {
      const remoteVideo = document.getElementById("remote-video");
      if (remoteVideo) {
        remoteVideo['srcObject'] = stream;
        (<any>window).stream = stream;
        this.startRecording(stream);
      }
    };
  }

  ngAfterViewInit(){
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
    navigator.getUserMedia(
      { video: true, audio: true },
      stream => {
        const localVideo = document.getElementById("local-video");
        if (localVideo) {
          (<any>window).stream = stream;
          localVideo['srcObject'] = stream;

        }

        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
      },
      error => {
        console.warn(error.message);
      }
    );
  }

  shareScreen() {
      mediaD.getDisplayMedia(
        { video: true},
        stream => {
          const remoteVideo = document.getElementById("remote-video");
          if (remoteVideo) {
            remoteVideo['srcObject'] = stream;
          }
          stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
      this.startRecording(stream);
        },
        error => {
          console.warn(error.message);
        }
      );
  }

  stopScreen() {

  }

  startRecording(stream) {
    try {
      this.mediaRecorder = new MediaRecorder(stream, this.recordingOptions);
    } catch (err) {
      console.error(err);
    }
    this.mediaRecorder.onstop = event => {
      console.log("Recorder Stop: ", event);
    };
    this.mediaRecorder.ondataavailable = ({ data }) => {
      if (data.size > 0) {
        this.recorderedVideo.push(data);
        console.log("tt",this.recorderedVideo);
        // console.log(this.recorderedVideo);
      }
    };
    this.mediaRecorder.start(10);
    console.log("Started Recording video", this.mediaRecorder);
  }

  stopRecording(){
    (<any>window).stream.getTracks().forEach(function(track) {
      if (track.readyState == 'live') {
          track.stop();
      }
  });
    // (<any>window).stream.getTracks().forEach(track => {
    //   track.stop();
    // });
    this.mediaRecorder.stop();
    const localVideo = document.getElementById("remote-video");
    if(localVideo){
    var videoBlob = new Blob(this.recorderedVideo, { type: "video/webm;" });
    console.log("vb",videoBlob)
    alert("Stopped Recording Video");
    // localVideo['src'] = window.URL.createObjectURL(videoBlob);
    }
  }



}
