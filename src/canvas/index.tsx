import { NormalizedLandmark, Pose, POSE_CONNECTIONS, ResultsListener } from "@mediapipe/pose";

import { Component, createSignal, Match, onMount, Show, Switch } from "solid-js";
import { Camera } from '@mediapipe/camera_utils';
import '@mediapipe/control_utils';
import { LandmarkGrid } from '@mediapipe/control_utils_3d';
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import styles from './canvas.module.css';
import { Vector } from "./vector";
import Card from "../components/Card";
import Skeleton from "../components/Skeleton";
import Button from "../components/Button";
import Select from "../components/Select";

const points = {
    leftEar: 7,
    rightEar: 8,

    leftShoulder: 11,
    rightShoulder: 12,

    leftHip: 23,
    rightHip: 24,

    referencePoint: 33
}

function distance(a: NormalizedLandmark, b: NormalizedLandmark): number {
    const dist = Math.sqrt((a.x - b.x) * (a.x - b.x) - (a.y - b.y) * (a.y - b.y));
    return Number.isNaN(dist) ? 0 : dist;
}

function calculateReferencePoint(hipPoint: NormalizedLandmark, shoulderPoint: NormalizedLandmark, neckExtension: number): NormalizedLandmark {
    const neckReference = new Vector(shoulderPoint.x - hipPoint.x, shoulderPoint.y - hipPoint.y).normalize().multiply(neckExtension);

    const referencePoint = {
        x: shoulderPoint.x + neckReference.x,
        y: shoulderPoint.y + neckReference.y,
        z: shoulderPoint.z
    }

    return referencePoint;
}

function distanceBetweenEarsAndReferencePoint(leftEar: NormalizedLandmark, rightEar: NormalizedLandmark, referencePoint: NormalizedLandmark) {
    const leftEarD = distance(leftEar, referencePoint);
    const rightEarD = distance(rightEar, referencePoint);

    return Math.min(leftEarD, rightEarD);
}

const OPTIMAL_DISTANCE = 0.12;

const Canvas: Component = () => {

    const [ready, setReady] = createSignal(true);
    const [currentDistance, setCurrentDistance] = createSignal(0);
    const [pretzel, setPretzelStatus] = createSignal(true);

    let camera;
    let pose: Pose;

    const init = () => {
        if (!ready()) {
            setReady(true);
        }
    }


    onMount(() => {

        return; // Disable processing

        const videoElement = document.getElementsByClassName('input_video')[0] as HTMLVideoElement;
        const canvasElement = document.getElementsByClassName('output_canvas')[0] as HTMLCanvasElement;
        const canvasCtx = canvasElement.getContext('2d') as CanvasRenderingContext2D;
        const landmarkContainer = document.getElementsByClassName('landmark-grid-container')[0] as HTMLDivElement;
        // const grid = new LandmarkGrid(landmarkContainer);

        // console.log(POSE_CONNECTIONS)

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

            const referencePoint = calculateReferencePoint(
                results.poseLandmarks[points.leftHip],
                results.poseLandmarks[points.leftShoulder],
                0.3
            );

            const distFromRef = distanceBetweenEarsAndReferencePoint(
                results.poseLandmarks[points.leftEar],
                results.poseLandmarks[points.rightEar],
                referencePoint
            );

            const isPretzelPose = distFromRef > OPTIMAL_DISTANCE;

            const modifiedLandmarks = [
                ...results.poseLandmarks,
                referencePoint
            ]

            const modifiedConnections: [number, number][] = [
                [points.leftHip, points.rightHip],
                [points.rightHip, points.rightShoulder],
                [points.leftHip, points.leftShoulder],
                [points.leftShoulder, points.rightShoulder],
                [points.leftShoulder, points.leftEar], [points.rightShoulder, points.rightEar],
                [points.leftShoulder, points.referencePoint], [points.rightShoulder, points.referencePoint]
            ]



            drawConnectors(canvasCtx, modifiedLandmarks, modifiedConnections,
                { color: '#00FF00', lineWidth: 4 });
            drawLandmarks(canvasCtx, results.poseLandmarks,
                { color: '#FF0000', lineWidth: 2 });
            canvasCtx.restore();

            // grid.updateLandmarks(results.poseWorldLandmarks);


            setCurrentDistance(distFromRef)
            setPretzelStatus(isPretzelPose)
        }

        pose = new Pose({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
            }
        });
        pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
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
        <div class="container sm:m-6 lg:m-16">
            <Show when={!ready()}>
                <p class="p-4 bg-red-600 text-3xl">Make sure to allow the use of camera.</p>
                <p class="p-4 bg-green-600 text-3xl">Processing the image...</p>
            </Show>
            <div class="flex flex-col lg:flex-row">
                <div class="sm:w-full lg:max-w-lg">
                    <Card>
                        <div class="mb-4">
                            <Switch fallback={<Skeleton type="image" />}>
                                <Match when={ready()}>
                                    <canvas class="output_canvas" width="640px" height="360px"></canvas>
                                </Match>
                            </Switch>
                        </div>
                        <Select
                            label="Body Side"
                            options={[
                                { label: "Left", value: 'left' },
                                { label: "Right", value: 'right' },
                            ]}
                            onChange={() => { }}
                            value="left"
                        />

                    </Card>
                </div>
                <Card>
                    <div class="container max-h-100 flex flex-col items-center">
                        <Show when={ready()}>
                            <h1 class="mb-4 text-3xl font-extrabold text-gray-900 dark:text-white md:text-5xl lg:text-6xl">
                                Are you a pretzel?
                                <span class="mx-1 text-transparent bg-clip-text bg-gradient-to-r to-emerald-600 from-sky-400">
                                    {pretzel() ? 'Yes you are.' : 'Not yet.'}
                                </span>

                            </h1>
                            <p class="text-lg font-normal font-mono text-gray-500 lg:text-xl dark:text-gray-400">Distance from reference point: {currentDistance()}</p>
                            <Show when={pretzel()}>
                                <img class={`${styles['pretzel-img']}`} src="https://media.newyorker.com/photos/60521c4b9274613edb14f271/1:1/w_1865,h_1865,c_limit/210329_r38112.jpg" />
                            </Show>
                        </Show>
                    </div>
                </Card>
            </div>
            <video class={`input_video ${styles.webcam}`}></video>
            <div class="landmark-grid-container"></div>
        </div>
    </div >
}

export default Canvas;