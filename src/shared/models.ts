/**
 * Kroppsmodellen hämtas från Google, låst version först och senaste som reserv.
 * VITE_POSE_MODEL_URL byter till en egen fil, till exempel vid test.
 * Delas av scenen, som läser modellen, och panelen, som kollar att den finns sparad för drift utan internet.
 */
const MODEL_ROOT = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16';

export const POSE_MODEL_URLS: string[] = import.meta.env.VITE_POSE_MODEL_URL
  ? [import.meta.env.VITE_POSE_MODEL_URL]
  : [`${MODEL_ROOT}/1/pose_landmarker_full.task`, `${MODEL_ROOT}/latest/pose_landmarker_full.task`];
