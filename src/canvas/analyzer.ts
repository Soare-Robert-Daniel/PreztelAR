import { NormalizedLandmark } from "@mediapipe/pose";
import { vec3 } from "munum";

interface IData {
    hips: [NormalizedLandmark, NormalizedLandmark],
    shoulders: [NormalizedLandmark, NormalizedLandmark],
    ears: [NormalizedLandmark, NormalizedLandmark],
    knee: [NormalizedLandmark, NormalizedLandmark]
    options: {
        neckExtension: number
    }
}

function analyze(data: IData) {
    const [leftHip, rightHip] = data.hips;
    const [leftShoulder, rightShoulder] = data.shoulders;
    const [leftEar, rightEar] = data.ears;
    const [leftKnee, rightKnee] = data.knee;
    const { options } = data;

    // Utility inline functions
    const distXY = (a: NormalizedLandmark, b: NormalizedLandmark) => {
        const dist = Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
        return Number.isNaN(dist) ? 0 : dist;
    }

    const midPoint = (a: NormalizedLandmark, b: NormalizedLandmark) => {
        return {
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
            z:( a.z + b.z) / 2
        }
    }

    const translateUp = (a: NormalizedLandmark) => {
        return {
            x: (a.x),
            y: (a.y - 0.3),
            z:( a.z)
        }
    }

    const getAngleFromNormal = ( p: any, center: any, n: any ) => {
        const a = vec3.create( p.x - center.x, p.y - center.y, p.z - center.z )
        const b = vec3.create( n.x - center.x, n.y - center.y, n.z - center.z )

        return Math.acos(
            Math.max(0, Math.min(1, vec3.dot(a, b) / ( vec3.len(a) * vec3.len(b) ) ))
        ) * 180 / Math.PI
    }

    const computeReferencePointWithHipsAndShoulders = () => {
        const side = ((leftShoulder.visibility ?? 0) > (rightShoulder.visibility ?? 0)) ? 'left' : 'right';

        const hip = side == 'left' ? leftHip : rightHip;
        const shoulder = side == 'right' ? leftShoulder : rightShoulder;
        
        const neckVector = vec3.scale(vec3.norm(vec3.create(shoulder.x - hip.x, shoulder.y - hip.y, shoulder.z - shoulder.z)), options.neckExtension);

        const referencePoint = {
            x: shoulder.x + neckVector[0],
            y: shoulder.y + neckVector[1],
            z: shoulder.z + neckVector[2]
        }

        return referencePoint;
    }

    const computeReferencePointWithOnlyShoulders = () => {
        const side = ((leftShoulder.visibility ?? 0) > (rightShoulder.visibility ?? 0)) ? 'left' : 'right';
        const shoulder = side == 'right' ? leftShoulder : rightShoulder;

        const up = vec3.create(0, -1, 0);
        const neckVector = vec3.scale( up, options.neckExtension );

        const referencePoint = {
            x: shoulder.x + neckVector[0],
            y: shoulder.y + neckVector[1],
            z: shoulder.z + neckVector[2]
        }

        return referencePoint;
    }

    const pointHipAndShoulder = computeReferencePointWithHipsAndShoulders();
    const pointShoulderOnly = computeReferencePointWithOnlyShoulders();
    const shoulderMidPoint = midPoint(leftShoulder, rightShoulder);
    const earsMidPoint = midPoint(leftEar, rightEar);
    const hipsMidPoint = midPoint(leftHip, rightHip);
    const kneeMidPoint = midPoint(leftKnee, rightKnee);
    const normalVertex =  translateUp(midPoint(leftShoulder, rightShoulder))


    return { 
        angle: getAngleFromNormal(earsMidPoint, shoulderMidPoint, normalVertex),
        secondAngle: getAngleFromNormal(kneeMidPoint, hipsMidPoint, shoulderMidPoint),
        pointHipAndShoulder, 
        pointShoulderOnly,
        shoulderMidPoint,
        earsMidPoint,
        normalVertex,
        hipsMidPoint,
        kneeMidPoint
    };
}

export default analyze;