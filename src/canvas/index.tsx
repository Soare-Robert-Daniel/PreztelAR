import type { NormalizedLandmark, Pose, POSE_CONNECTIONS, ResultsListener } from "@mediapipe/pose";
import { Component, createEffect, createSignal, Match, onMount, Show, Switch } from "solid-js";
import type { Camera } from '@mediapipe/camera_utils';
import '@mediapipe/control_utils';
import type { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import styles from './canvas.module.css';
import { vec3 } from 'munum';
import Card from "../components/Card";
import Skeleton from "../components/Skeleton";
import RangeInput from "../components/RangeInput";
import { mean } from "simple-statistics";
import analyze from "./analyzer";
import Button from "../components/Button";
import createYouAreAPretzelNotification from "./notification";
import classNames from "classnames";

const points = {
    leftEar: 7,
    rightEar: 8,

    leftShoulder: 11,
    rightShoulder: 12,

    leftHip: 23,
    rightHip: 24,

    leftKnee: 25,
    rightKnee: 26,

    referencePoint: 33,
    secondReferencePoint: 34,

    shoulderMidPoint: 35,
    earsMidPoint: 36,

    normalVertex: 37,
    hipsMidPoint: 38,
    kneeMidPoint: 39
}

const NECK_EXTENSION_LENGTH = 0.5;
const OPTIMAL_ANGLE = 20;
const FRAME_THRESHOLD = 30;
const RUNNING_TIME = 120;
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
    const [currentAngle, setCurrentAngle] = createSignal(0);
    const [experimentalAngle, setExperimentalAngle] = createSignal(0);
    const [pretzel, setPretzelStatus] = createSignal(false);
    const [threshold, setThreshold] = createSignal(OPTIMAL_ANGLE);
    const [avgDistance, setAvgDistance] = createSignal(0);
    const [frameThreshold, setFrameThreshold] = createSignal(FRAME_THRESHOLD)
    const [runningStatus, setRunningStatus] = createSignal(false)
    const [runningTime, setRunningTime] = createSignal(RUNNING_TIME)
    const [intervalTime, setIntervalTime] = createSignal(INTERVAL_TIME)
    const [remainingTime, setRemainingTime] = createSignal(0)
    const [currentRunningTime, setCurrentRunningTime] = createSignal(0)
    const [currentWaitingTime, setCurrentWaitingTime] = createSignal(0)
    const [hideWebcam, setHideWebcam] = createSignal(true);

    let camera: Camera;
    let pose: Pose;
    let frameCount = 0;
    let anglesFromReference: number[] = []
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

            const result = analyze({
                shoulders: [results.poseLandmarks[points.leftShoulder], results.poseLandmarks[points.rightShoulder]],
                hips: [results.poseLandmarks[points.leftHip], results.poseLandmarks[points.rightHip]],
                ears: [results.poseLandmarks[points.leftEar], results.poseLandmarks[points.rightEar]],
                options: {
                    neckExtension: NECK_EXTENSION_LENGTH
                },
                knee: [results.poseLandmarks[points.leftKnee], results.poseLandmarks[points.rightKnee]],
            });

            const modifiedLandmarks = [
                ...results.poseLandmarks,
                result.pointHipAndShoulder,
                result.pointShoulderOnly,
                result.shoulderMidPoint,
                result.earsMidPoint,
                result.normalVertex,
                result.hipsMidPoint,
                result.kneeMidPoint
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
                [points.shoulderMidPoint, points.normalVertex],
                [points.leftHip, points.hipsMidPoint],
                [points.rightHip, points.hipsMidPoint],
                [points.hipsMidPoint, points.shoulderMidPoint],
                [points.hipsMidPoint, points.kneeMidPoint],
                // [points.leftShoulder, points.referencePoint], [points.rightShoulder, points.
            ]

            const pointsToDraw = [
                results.poseLandmarks[points.leftShoulder], results.poseLandmarks[points.rightShoulder],
                results.poseLandmarks[points.leftEar], results.poseLandmarks[points.rightEar],
                results.poseLandmarks[points.leftHip], results.poseLandmarks[points.rightHip],
                results.poseLandmarks[points.leftKnee], results.poseLandmarks[points.rightKnee]
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


            anglesFromReference.push(result.angle);

            if (frameCount > frameThreshold()) {
                const isPretzelPose = mean(anglesFromReference) > threshold() || result.secondAngle < 70;

                setPretzelStatus(isPretzelPose)
                setAvgDistance(mean(anglesFromReference))
                frameCount -= FRAME_THRESHOLD;
                anglesFromReference = []
            }

            setCurrentAngle(result.angle)
            setExperimentalAngle(result.secondAngle)
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

    createEffect(() => {
        if (pretzel()) {
            createYouAreAPretzelNotification()
        }
    })

    return <div class="flex justify-center">
        <div class="container sm:m-6 lg:mx-16 lg:my-4">
            <Show when={!ready()}>
                <p class="p-2 bg-red-600 text-xl rounded">Make sure to allow the use of camera.</p>
                {/* <p class="p-4 bg-green-600 text-3xl">Processing the image...</p> */}
            </Show>
            <div class="m-3">
                <h2 class="flex items-center text-4xl font-extrabold dark:text-white">
                    <span class="">
                        Hosted on
                    </span>
                    <a class="mx-1 g-blue-100 text-blue-800 text-2xl font-semibold mr-2 px-2.5 py-1 rounded dark:bg-blue-200 dark:text-blue-800 ml-2" href="https://preztel-ar.vercel.app">
                        preztel-ar.vercel.app
                    </a>
                </h2>
            </div >
            <div class="flex justify-center">
                <div class="sm:w-full lg:max-w-5xl">
                    <Card>
                        <div class="container max-h-100 flex flex-row items-center gap-4 justify-center">
                            <div class="flex flex-col gap-2">
                                <Show when={!ready()}>
                                    <h1 class="mb-1 text-3xl font-extrabold text-gray-900 dark:text-white md:text-5xl lg:text-6xl">
                                        Press 'Start' to begin.
                                    </h1>
                                </Show>

                                <Show when={ready()}>
                                    <h1 class="mb-4 text-3xl font-extrabold text-gray-900 dark:text-white md:text-5xl lg:text-6xl">
                                        Are you a pretzel?
                                    </h1>
                                    <span class="mb-4 text-3xl font-extrabold  md:text-5xl lg:text-6xl mx-1 text-transparent bg-clip-text bg-gradient-to-r to-emerald-600 from-sky-400">
                                        {pretzel() ? 'Yes, you are.' : 'Not yet.'}
                                    </span>
                                </Show>

                                <br /><br />

                                <p class="text-lg font-normal font-mono text-gray-500 lg:text-xl dark:text-gray-300">You are a pretzel if the angle between your ears and shoulders is above:
                                    <span class="mx-1">
                                        {
                                            threshold()
                                        }°
                                    </span>

                                    ( current angle
                                    <span class="mx-2 underline underline-offset-4">
                                        {avgDistance().toFixed(2)}°
                                    </span>
                                    )
                                </p>
                                <p class="text-base font-normal font-mono text-gray-500 lg:text-base dark:text-gray-300">[Experimental] You can also be a pretzel if he angle between your upper body and lower body is lower than 80°:
                                    ( current angle
                                    <span class="mx-2 underline underline-offset-4">
                                        {experimentalAngle().toFixed(2)}°
                                    </span>
                                    )
                                </p>
                                {/* <p class="text-lg font-normal font-mono text-gray-500 lg:text-xl dark:text-gray-400">Real-time angle (Ears, Shoulders, Reference): {currentAngle().toFixed(2)}°</p>
                                <p class="text-base font-normal font-mono text-gray-500 lg:text-base dark:text-gray-400">Real-time angle (Shoulder, Hips, Knees): {experimentalAngle().toFixed(2)}°</p> */}
                            </div>

                            <div>
                                <img class={classNames(`${styles['pretzel-img']}`, { 'invisible': !pretzel() })} src="https://media.newyorker.com/photos/60521c4b9274613edb14f271/1:1/w_1865,h_1865,c_limit/210329_r38112.jpg" />
                            </div>
                        </div>
                    </Card>

                    <Show when={ready()}>
                        <Card>
                            <div class="container max-h-100 flex flex-row items-center gap-4 justify-center">
                                <p class="text-xl font-normal font-mono text-gray-500 lg:text-2xl dark:text-gray-100">
                                    {runningStatus() ? "Program ends in: " : "Program start in: "}
                                    <span class="mx-1">
                                        {currentRunningTime()}s
                                    </span>
                                </p>
                            </div>
                        </Card>
                    </Show>

                    <Card>
                        <div
                        // class="border-2 p-4 rounded-xl bg-gray-100 dark:border-gray-200 dark:bg-gray-900"
                        >
                            <div class="flex row">
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
                            </div>

                            <RangeInput
                                label="Ears Shoulder Angle threshold"
                                id="distance-threshold"
                                onChange={value => setThreshold(value)}
                                value={threshold()}
                                min={0}
                                max={90}
                                step={1}
                                help={"Set the threshold angle between your ears and reference point (the straight line that from the base of the neck). If above, you are considered a pretzel."}
                            />
                            <RangeInput
                                label="Frame to analyze"
                                id="frame-threshold"
                                onChange={value => setFrameThreshold(value)}
                                value={frameThreshold()}
                                help={"Set how many frame should be processed before given the verdict."}
                            />
                            <RangeInput
                                label="Running Time (s)"
                                id="frame-running"
                                onChange={value => setRunningTime(value)}
                                value={runningTime()}
                                min={3}
                                max={180}
                                step={1}
                                help={`Set how many seconds to run the pose analyzer. E.g.: Run for ${runningTime()}s`}
                            />
                            <RangeInput
                                label="Pause Interval (s)"
                                id="frame-pause"
                                onChange={value => setIntervalTime(value)}
                                value={intervalTime()}
                                min={0}
                                max={600}
                                step={1}
                                help={`Set how much time should wait before running again (meanwhile the camera will be stopped). E.g.: Run this after ${intervalTime()} seconds for ${runningTime()}s`}
                            />


                        </div>
                    </Card>
                    <Card>
                        <h2 class="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Technology used:</h2>
                        <ul class="max-w-md space-y-1 text-gray-500 list-disc list-inside dark:text-gray-400">
                            <li>
                                <a href="https://google.github.io/mediapipe/" target="_blank" >Pose analyze: Google MediaPipe</a>
                            </li>
                            <li>
                                <a href="https://github.com/andykswong/munum" target="_blank" >3D Math Library: munum</a>
                            </li>
                            <li>
                                <a href="https://simplestatistics.org" target="_blank" >Statistics Library: simple-statistics</a>
                            </li>
                            <li>
                                <a href="https://www.solidjs.com" target="_blank" >Reactive Interface: SolidJS</a>
                            </li>
                            <li>
                                <a href="https://tailwindcss.com" target="_blank" >CSS Utility Framework: Tailwind</a>
                            </li>
                            <li>
                                <a href="https://flowbite.com/docs/typography/lists/" target="_blank" >Tailwind Framework: Flowbite</a>
                            </li>
                            <li>
                                <a class="underline underline-offset-4" href="https://github.com/Soare-Robert-Daniel/PreztelAR" target="_blank" >Source code for Human and AI training.</a>
                            </li>
                        </ul>

                    </Card>
                </div>
            </div>
            <div class={`flex justify-center flex-col ${styles.webcam}`}>

                <div class="flex flex-row gap-1">
                    <div class={classNames({ 'invisible': hideWebcam() || !runningStatus() })}>
                        <video class={`input_video`} width="480" height="270"></video>
                    </div>

                    <div class={classNames({ 'invisible': !runningStatus() })}>
                        <canvas class="output_canvas" width="480" height="270"></canvas>
                    </div>
                </div>
                <div class="flex justify-end">
                    <Show when={ready()}>
                        <Button
                            onClick={() => setHideWebcam(!hideWebcam())}
                        >
                            {hideWebcam() ? 'Show  Webcam' : 'Hide  Webcam'}
                        </Button>
                    </Show>
                </div>
            </div>

            <div class="landmark-grid-container"></div>
        </div>
    </div >
}

export default Canvas;