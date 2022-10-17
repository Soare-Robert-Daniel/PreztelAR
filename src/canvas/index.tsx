import { Pose, POSE_CONNECTIONS, ResultsListener  } from "@mediapipe/pose";
 
import { Component, createSignal, onMount, Show } from "solid-js";
import { Camera } from '@mediapipe/camera_utils';
import '@mediapipe/control_utils';
import { LandmarkGrid } from '@mediapipe/control_utils_3d';
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import styles from './canvas.module.css';


const Canvas: Component = () => {

    const [ready, setReady] = createSignal(false);

    let camera;
    let pose: Pose;

    const init = () => {
        if( ! ready()) {
            setReady(true);
        }
    }


    onMount(() => {
   
        const videoElement = document.getElementsByClassName('input_video')[0] as HTMLVideoElement;
        const canvasElement = document.getElementsByClassName('output_canvas')[0] as HTMLCanvasElement;
        const canvasCtx = canvasElement.getContext('2d') as CanvasRenderingContext2D;
        const landmarkContainer = document.getElementsByClassName('landmark-grid-container')[0] as HTMLDivElement;
        // const grid = new LandmarkGrid(landmarkContainer);

        const onResults: ResultsListener = (results) => {
            if (!results.poseLandmarks) {
               // grid.updateLandmarks([]);
                return;
            }

            init();

            canvasCtx.save();
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            // canvasCtx.drawImage(results.segmentationMask, 0, 0,
            //     canvasElement.width, canvasElement.height);

            // Only overwrite existing pixels.
            canvasCtx.globalCompositeOperation = 'source-in';
            // canvasCtx.fillStyle = '#00FF00';
            canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);

            // Only overwrite missing pixels.
            canvasCtx.globalCompositeOperation = 'destination-atop';
            canvasCtx.drawImage(
                results.image, 0, 0, canvasElement.width, canvasElement.height);

            canvasCtx.globalCompositeOperation = 'source-over';
            
            drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,
                { color: '#00FF00', lineWidth: 4 });
            drawLandmarks(canvasCtx, results.poseLandmarks,
                { color: '#FF0000', lineWidth: 2 });
            canvasCtx.restore();

           // grid.updateLandmarks(results.poseWorldLandmarks);
        }

        pose = new Pose({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
            }
        });
        pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: true,
            smoothSegmentation: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });



        pose.onResults(onResults);

        camera = new Camera(videoElement, {
            onFrame: async () => {
                await pose.send({ image: videoElement });
            },
            width: 1280,
            height: 720,
        });
        camera.start();

    })

    return <div class="flex justify-center">
        <div class="container">
            <Show when={!ready()}>
                <p class="p-4 bg-red-600 text-3xl">Make sure the allow the use of camera.</p>
                <p class="p-4 bg-green-600 text-3xl">Processing the image...</p>
            </Show>
            <video class={`input_video ${styles.webcam}`}></video>
            <canvas class="output_canvas" width="1280px" height="720px"></canvas>
            <div class="landmark-grid-container"></div>
        </div>
    </div>
}

export default Canvas;