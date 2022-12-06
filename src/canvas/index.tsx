import type { NormalizedLandmark, Pose, POSE_CONNECTIONS, ResultsListener } from "@mediapipe/pose";
import { Component, createEffect, createSignal, Match, onMount, Show, Switch } from "solid-js";
import type { Camera } from '@mediapipe/camera_utils';
import '@mediapipe/control_utils';
import { LandmarkGrid } from '@mediapipe/control_utils_3d';
import type { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import styles from './canvas.module.css';
import { vec3 } from 'munum';
import Card from "../components/Card";
import Skeleton from "../components/Skeleton";
import RangeInput from "../components/RangeInput";
import { mean } from "simple-statistics";
import analyze from "./analyzer";
import Button from "../components/Button";

const points = {
    leftEar: 7,
    rightEar: 8,

    leftShoulder: 11,
    rightShoulder: 12,

    leftHip: 23,
    rightHip: 24,

    referencePoint: 33,
    secondReferencePoint: 34,

    shoulderMidPoint: 35,
    earsMidPoint: 36,

    normalVertex: 37
}

const NECK_EXTENSION_LENGTH = 0.5;
const OPTIMAL_ANGLE = 20;
const FRAME_THRESHOLD = 30;
const RUNNING_TIME = 60;
const INTERVAL_TIME = 20

function distance(a: NormalizedLandmark, b: NormalizedLandmark): number {
    const dist = Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)) //+ (a.z - b.z) * (a.z - b.z));
    return Number.isNaN(dist) ? 0 : dist;
}

function calculateReferencePoint(hipPoint: NormalizedLandmark, shoulderPoint: NormalizedLandmark, neckExtension: number): NormalizedLandmark {
    const neckReference = vec3.scale(vec3.norm(vec3.create(shoulderPoint.x - hipPoint.x, shoulderPoint.y - hipPoint.y, shoulderPoint.z - shoulderPoint.z)), neckExtension);

    const referencePoint = {
        x: shoulderPoint.x + neckReference[0],
        y: shoulderPoint.y + neckReference[1],
        z: shoulderPoint.z + neckReference[2]
    }

    return referencePoint;
}


const Canvas: Component = () => {

    const [ready, setReady] = createSignal(false);
    const [currentDistance, setCurrentDistance] = createSignal(0);
    const [pretzel, setPretzelStatus] = createSignal(true);
    const [threshold, setThreshold] = createSignal(OPTIMAL_ANGLE);
    const [avgDistance, setAvgDistance] = createSignal(0);
    const [frameThreshold, setFrameThreshold] = createSignal(FRAME_THRESHOLD)
    const [runningStatus, setRunningStatus] = createSignal(false)
    const [runningTime, setRunningTime] = createSignal(RUNNING_TIME)
    const [intervalTime, setIntervalTime] = createSignal(INTERVAL_TIME)
    const [remainingTime, setRemainingTime] = createSignal(0)
    const [currentRunningTime, setCurrentRunningTime] = createSignal(0)
    const [currentWaitingTime, setCurrentWaitingTime] = createSignal(0)

    let camera: Camera;
    let pose: Pose;
    let frameCount = 0;
    let distances: number[] = []
    let interval: number | undefined;
    let forceStop = false;


    const init = () => {
        if (!ready()) {
            setReady(true);
        }
    }

    const startTimer = () => {
        clearInterval(interval)
        interval = setInterval(() => {
            if (forceStop === true) {
                clearInterval(interval)
                return;
            }
            setCurrentRunningTime(x => Math.round(x - 0.6))
        }, 600)
    }

    const startProgram = () => {
        forceStop = false
        camera?.start?.()
        setCurrentRunningTime(runningTime())
        setRunningStatus(true)
        startTimer()
    }

    const stopProgram = () => {
        camera?.stop?.()
        setCurrentRunningTime(intervalTime())
        setRunningStatus(false)
        startTimer()
    }

    const forceStopProgram = () => {
        clearInterval(interval)
        camera?.stop?.()
        setRunningStatus(false)
    }


    onMount(() => {

        // return; // Disable processing

        const videoElement = document.getElementsByClassName('input_video')[0] as HTMLVideoElement;
        const canvasElement = document.getElementsByClassName('output_canvas')[0] as HTMLCanvasElement;
        const canvasCtx = canvasElement.getContext('2d') as CanvasRenderingContext2D;
        const landmarkContainer = document.getElementsByClassName('landmark-grid-container')[0] as HTMLDivElement;
        // const grid = new LandmarkGrid(landmarkContainer);

        // console.log(POSE_CONNECTIONS)

        const onResults: ResultsListener = (results) => {

            frameCount = frameCount + 1;

            if (!results.poseLandmarks) {
                // grid.updateLandmarks([]);
                return;
            }
            init();

            // console.log(results);

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

            const referencePoint = (results?.poseLandmarks?.[points?.leftShoulder]?.visibility ?? 0) > (results?.poseLandmarks?.[points?.rightShoulder]?.visibility ?? 0) ?
                calculateReferencePoint(
                    results.poseLandmarks[points.leftHip],
                    results.poseLandmarks[points.leftShoulder],
                    NECK_EXTENSION_LENGTH
                )
                : calculateReferencePoint(
                    results.poseLandmarks[points.rightHip],
                    results.poseLandmarks[points.rightShoulder],
                    NECK_EXTENSION_LENGTH
                );

            // const distFromRef = (results?.poseLandmarks?.[points?.leftShoulder]?.visibility ?? 0) > (results?.poseLandmarks?.[points?.rightShoulder]?.visibility ?? 0)
            //     ? distance(results.poseLandmarks[points.leftEar], referencePoint)
            //     : distance(results.poseLandmarks[points.rightEar], referencePoint);

            const distFromRef = analyze({
                shoulders: [results.poseLandmarks[points.leftShoulder], results.poseLandmarks[points.rightShoulder]],
                hips: [results.poseLandmarks[points.leftHip], results.poseLandmarks[points.rightHip]],
                ears: [results.poseLandmarks[points.leftEar], results.poseLandmarks[points.rightEar]],
                options: {
                    neckExtension: NECK_EXTENSION_LENGTH
                }

            });

            const modifiedLandmarks = [
                ...results.poseLandmarks,
                distFromRef.pointHipAndShoulder,
                distFromRef.pointShoulderOnly,
                distFromRef.shoulderMidPoint,
                distFromRef.earsMidPoint,
                distFromRef.normalVertex
            ]

            const modifiedConnections: [number, number][] = [
                // [points.leftHip, points.rightHip],
                // [points.rightHip, points.rightShoulder],
                // [points.leftHip, points.leftShoulder],
                // [points.leftShoulder, points.rightShoulder],
                // [points.leftShoulder, points.leftEar], [points.rightShoulder, points.rightEar],
                // [points.leftShoulder, points.referencePoint], [points.rightShoulder, points.referencePoint],
                // [points.secondReferencePoint, points.leftEar],
                // [points.secondReferencePoint, points.rightEar],
                [points.leftShoulder, points.shoulderMidPoint],
                [points.rightShoulder, points.shoulderMidPoint],

                [points.earsMidPoint, points.shoulderMidPoint],
                [points.earsMidPoint, points.leftEar],
                [points.earsMidPoint, points.rightEar],
                [points.shoulderMidPoint, points.normalVertex]
                // [points.leftShoulder, points.referencePoint], [points.rightShoulder, points.
            ]

            const pointsToDraw = [
                results.poseLandmarks[points.leftShoulder], results.poseLandmarks[points.rightShoulder],
                results.poseLandmarks[points.leftEar], results.poseLandmarks[points.rightEar]
            ]



            // @ts-ignore
            drawConnectors(canvasCtx, modifiedLandmarks, modifiedConnections,
                { color: '#00FF00', lineWidth: 4 });
            // @ts-ignore
            drawLandmarks(canvasCtx, pointsToDraw,
                { color: '#FF0000', lineWidth: 2 });

            // @ts-ignore
            drawConnectors(canvasCtx, modifiedLandmarks, [points.shoulderMidPoint, points.normalVertex],
                { color: '#FFFF00', lineWidth: 2 });
            canvasCtx.restore();

            // grid.updateLandmarks(results.poseWorldLandmarks);


            distances.push(distFromRef.dist);

            if (frameCount > frameThreshold()) {
                const isPretzelPose = mean(distances) > threshold();

                setPretzelStatus(isPretzelPose)
                setAvgDistance(mean(distances))
                frameCount -= FRAME_THRESHOLD;
                distances = []
            }

            setCurrentDistance(distFromRef.dist)
        }

        setTimeout(() => {
            // @ts-ignore
            pose = new Pose({
                locateFile: (file: any) => {
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

            // @ts-ignore
            camera = new Camera(videoElement, {
                onFrame: async () => {
                    await pose.send({ image: videoElement });
                },
                width: 1280,
                height: 720,

            });
        }, 1000);
    })

    createEffect(() => {
        if (currentRunningTime() < 0) {
            clearInterval(interval)
            if (runningStatus()) {
                stopProgram()
            } else {
                startProgram()
            }
        }
    })

    return <div class="flex justify-center">
        <div class="container sm:m-6 lg:m-16">
            <Show when={!ready()}>
                <p class="p-4 bg-red-600 text-3xl">Make sure to allow the use of camera.</p>
                {/* <p class="p-4 bg-green-600 text-3xl">Processing the image...</p> */}
            </Show>
            <div class="flex flex-col lg:flex-row">
                <div class="sm:w-full lg:max-w-3xl">
                    <Card>
                        <div class="mb-4 flex justify-center align-middle">
                            <canvas class="output_canvas" width="640px" height="360px"></canvas>
                        </div>

                        <div
                            class="border-2 p-3 rounded"
                        >
                            <Switch>
                                <Match when={!runningStatus()}>
                                    <Button
                                        onClick={startProgram}
                                    >
                                        Start
                                    </Button>
                                </Match>
                                <Match when={runningStatus()}>
                                    <Button
                                        onClick={forceStopProgram}
                                        variant="error"
                                    >
                                        Stop
                                    </Button>
                                </Match>
                            </Switch>
                            <RangeInput
                                label="Angle threshold"
                                id="distance-threshold"
                                onChange={value => setThreshold(value)}
                                value={threshold()}
                                min={0}
                                max={90}
                                step={1}
                                help={"The angle between your ears and reference point. If above, you are considered a pretzel."}
                            />
                            <RangeInput
                                label="Frame threshold"
                                id="frame-threshold"
                                onChange={value => setFrameThreshold(value)}
                                value={frameThreshold()}
                                help={"How many frame should be processed before given the verdict."}
                            />
                            <RangeInput
                                label="Running Time (s)"
                                id="frame-running"
                                onChange={value => setRunningTime(value)}
                                value={runningTime()}
                                min={3}
                                max={180}
                                step={1}
                                help={`How many seconds to run the pose analyzer. E.g.: Run for ${runningTime()}s`}
                            />
                            <RangeInput
                                label="Pause Interval (s)"
                                id="frame-pause"
                                onChange={value => setIntervalTime(value)}
                                value={intervalTime()}
                                min={0}
                                max={600}
                                step={1}
                                help={`The length of interval between run sequences. E.g.: Run this after ${intervalTime()} seconds for ${runningTime()}s`}
                            />

                            
                        </div>
                    </Card>
                </div>
                <Show when={ready()}>
                    <Card>
                        <div class="container max-h-100 flex flex-col items-center">
                            <h1 class="mb-4 text-3xl font-extrabold text-gray-900 dark:text-white md:text-5xl lg:text-6xl">
                                Are you a pretzel?
                            </h1>
                            <span class="mb-4 text-3xl font-extrabold  md:text-5xl lg:text-6xl mx-1 text-transparent bg-clip-text bg-gradient-to-r to-emerald-600 from-sky-400">
                                {pretzel() ? 'Yes you are.' : 'Not yet.'}
                            </span>
                            <p class="text-lg font-normal font-mono text-gray-500 lg:text-xl dark:text-gray-400">Considered angle: {avgDistance().toFixed(2)}°</p>
                            <p class="text-lg font-normal font-mono text-gray-500 lg:text-xl dark:text-gray-400">Real-time angle: {currentDistance().toFixed(2)}°</p>
                            <p class="text-lg font-normal font-mono text-gray-500 lg:text-xl dark:text-gray-400">
                                {runningStatus() ? "Program ends in: " : "Program start in: "}
                                {currentRunningTime()}s
                            </p>

                            <Show when={pretzel()}>
                                <img class={`${styles['pretzel-img']}`} src="https://media.newyorker.com/photos/60521c4b9274613edb14f271/1:1/w_1865,h_1865,c_limit/210329_r38112.jpg" />
                            </Show>
                        </div>
                    </Card>
                </Show>
            </div>
            <video class={`input_video ${styles.webcam}`}></video>
            <div class="landmark-grid-container"></div>
        </div>
    </div >
}

export default Canvas;