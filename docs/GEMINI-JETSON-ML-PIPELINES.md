# Gemini 2.5 Pro - Jetson ML Pipeline Specifications

Of course. As a computer vision engineer specializing in the Jetson Orin Nano 8GB, I understand the critical importance of precise specifications that respect the hardware's constraints, particularly the 8GB of shared LPDDR5 memory.

Here are the exact specifications for your five marine ML pipelines.

---

### **PIPELINE 1: FISH DETECTION FROM UNDERWATER CAMERA**

This is a classic real-time object detection task. The key is balancing accuracy with the low-latency constraint on the Orin Nano's architecture.

| Specification | Value |
| :--- | :--- |
| **Model Name** | **YOLOv8s-int8** (quantized with TensorRT) |
| **VRAM Usage** | **~1.2 GB** (shared memory) |
| **Latency** | **~25-35ms per frame** |
| **Training Data** | 5,000+ labeled images of target fish species |
| **Deployment** | TensorRT Engine (`.engine` file) |

#### **Detailed Breakdown**

1.  **Model Specifications:**
    *   **Exact Model:** We'll use `yolov8s.pt` from Ultralytics as the base. The 's' (small) model provides the best trade-off between the Orin Nano's 1024 CUDA cores and the accuracy needed for species classification. The 'n' (nano) version is faster but may struggle to differentiate similar-looking species.
    *   **Heads:** The model will be trained with three outputs:
        1.  `reg_box`: Bounding box regression.
        2.  `cls`: Species classification (one class per species).
        3.  `cls_size`: A secondary classification head for size categories (e.g., Small, Medium, Large). Estimating exact cm/inches is unreliable without stereo cameras or known distances. Classifying size is far more robust.

2.  **Input Preprocessing:**
    *   Capture from USB camera using `v4l2` GStreamer pipeline for zero-copy memory access.
    *   Resize `640x480` -> `640x640` (letterboxing to preserve aspect ratio).
    *   Convert HWC (Height, Width, Channel) to CHW format.
    *   Normalize pixel values from `[0, 255]` to `[0, 1]`.
    *   Convert from BGR (OpenCV default) to RGB.

3.  **Postprocessing:**
    *   Apply a confidence threshold of `0.40`.
    *   Perform Non-Maximal Suppression (NMS) with an IoU threshold of `0.50` to eliminate duplicate boxes.
    *   Decode bounding box coordinates back to the original `640x480` image space.
    *   For each valid box, output the species class (from `cls` head) and size class (from `cls_size` head).

4.  **Memory Budget Breakdown (Shared 8GB Pool):**
    *   **Jetson OS & System:** ~1.5 GB
    *   **CUDA/TensorRT Context:** ~0.5 GB
    *   **Model Weights & Activations (YOLOv8s-int8):** ~1.2 GB
    *   **Input/Output Buffers (GStreamer/OpenCV):** ~0.3 GB
    *   **Application Logic (Python/C++):** ~0.2 GB
    *   **Remaining Headroom:** ~4.3 GB
    *   **Total VRAM Constraint:** **<4GB is easily met.**

5.  **Training on Custom Dataset:**
    1.  **Collect Data:** Capture thousands of images of your target fish species in various conditions (lighting, water clarity).
    2.  **Labeling:** Use a tool like **Roboflow** or **CVAT**. For each fish, draw a bounding box, assign the species label (e.g., `cod`, `tuna`), and assign a size label (e.g., `cod_small`, `cod_medium`).
    3.  **Training:** Use the Ultralytics Python library to fine-tune the pre-trained `yolov8s.pt` model on your custom dataset. A T4 or V100 cloud GPU is recommended for this step.
    4.  **Export:** Export the final trained PyTorch model (`.pt`) to ONNX format: `yolo export model=best.pt format=onnx opset=12`.

6.  **TensorRT Optimization Steps:**
    1.  On the Jetson Orin Nano, use the `trtexec` command-line tool to convert the ONNX model to a highly optimized TensorRT engine.
    2.  **Crucially, use INT8 quantization for maximum performance.** This requires a calibration dataset (a subset of ~500 of your training images).
    3.  **Command:**
        ```bash
        /usr/src/tensorrt/bin/trtexec --onnx=best.onnx \
                                      --saveEngine=best_int8.engine \
                                      --int8 \
                                      --calibCache=calibration.cache \
                                      --inputIOFormats=fp16:chw \
                                      --outputIOFormats=fp16:chw
        ```

#### **Code Structure (Python)**

```
/project
|-- main.py             # Main application loop
|-- engine.py           # TensorRT engine loading and inference wrapper
|-- camera.py           # GStreamer camera capture class
|-- postprocessing.py   # NMS and box decoding logic
|-- best_int8.engine    # Your compiled TensorRT model
|-- labels.txt          # Class names for species and sizes
```

---

### **PIPELINE 2: DEPTH SOUNDER TO SEABED MAP**

This pipeline is about data aggregation and spatial interpolation, not heavy deep learning. It's CPU-bound and memory-efficient.

| Specification | Value |
| :--- | :--- |
| **Data Structure** | NumPy 2D array for the map, KD-Tree for spatial queries |
| **Algorithm** | Inverse Distance Weighting (IDW) Interpolation |
| **Classification** | Rule-based on bottom hardness data (if available) or depth variance |
| **VRAM Usage** | **~0 GB** (CPU-only) |
| **Latency** | Map update in **<50ms** per ping |

#### **Detailed Breakdown**

1.  **Data Structure for Sonar Sweep:**
    *   **Raw Data Points:** A list of tuples `(timestamp, latitude, longitude, depth_meters, bottom_hardness)`. The Deeper Pro+ provides depth and a bottom hardness indicator.
    *   **Spatial Index:** A `scipy.spatial.cKDTree` built from the collected (lat, lon) coordinates. This allows for extremely fast nearest-neighbor lookups, which is essential for interpolation.
    *   **Map Grid:** A `numpy.ndarray` representing the map area. The resolution can be defined (e.g., 1 meter per pixel). Initialize with `np.nan`.

2.  **Map Generation Algorithm:**
    1.  **Accumulation:** As the boat moves, parse the NMEA 0183 `DPT` sentences from the sonar's Wi-Fi stream. For each ping, extract GPS coordinates (from `RMC` or `GGA` sentences) and depth. Add the `(lat, lon, depth)` point to your list.
    2.  **Grid Update:** When a new point is added, you don't need to re-interpolate the whole map. You can update a local region.
    3.  **Interpolation (Inverse Distance Weighting):** To calculate the depth for an empty map cell `(x, y)`:
        *   Use the KD-Tree to find the `k` (e.g., 8) nearest sonar pings to that cell.
        *   Calculate a weighted average of their depths. The weight for each ping is `1 / distance^p`, where `p` is a power parameter (typically 2). Pings that are closer have a much higher influence.
        *   This is computationally efficient and provides smooth, realistic results without the complexity of Kriging.

3.  **Seabed Classification Approach:**
    *   **Method 1 (Using Hardness Data):** The Deeper Pro+ provides a bottom hardness value.
        *   Store this value alongside depth in your data structure.
        *   Interpolate the hardness value across the map grid, just like depth.
        *   Apply a simple rule-based classifier:
            *   `if hardness < 0.3:` -> `seabed = 'sand'`
            *   `if 0.3 <= hardness < 0.7:` -> `seabed = 'kelp/weed'`
            *   `if hardness >= 0.7:` -> `seabed = 'rock'`
            *   (Thresholds must be calibrated based on observation).
    *   **Method 2 (Using Depth Variance):** If hardness data is unavailable.
        *   For each grid cell, look at the standard deviation of the depth of the nearest pings.
        *   `low variance` -> `smooth bottom (sand)`
        *   `high variance` -> `rough bottom (rock)`

#### **Code Structure (Python)**

```
/project
|-- main.py                 # Connects to sonar, updates map
|-- sonar_parser.py         # Parses NMEA 0183 sentences
|-- seabed_map.py           # Class to manage map grid, KD-Tree, and interpolation
|-- map_visualizer.py       # (Optional) Uses OpenCV or Matplotlib to display the map
```

---

### **PIPELINE 3: DRONE AERIAL STITCHING**

This is an offline, high-memory batch processing task. The key is managing memory by not loading the entire dataset at once.

| Specification | Value |
| :--- | :--- |
| **Library** | **OpenCV** with SIFT/ORB feature detection |
| **Georeferencing** | Extracting per-frame GPS from video's SRT subtitle file |
| **Algorithm** | Incremental Stitching + Image Pyramids |
| **VRAM Usage** | **~2-3 GB** during feature matching, but CPU memory is the main constraint |
| **Processing Time** | Several hours for a 15-minute 4K video |

#### **Detailed Breakdown**

1.  **OpenCV Pipeline Steps:**
    1.  **Frame Extraction & Geotagging:** Use `ffmpeg` to extract frames from the 4K video. Simultaneously, parse the accompanying `.SRT` file, which DJI drones generate, to get a `(timestamp, lat, lon, altitude)` for each frame. Store this in a metadata dictionary.
    2.  **Feature Detection:** For each frame, downscale it (e.g., to 1080p) to speed up feature detection. Use `cv2.SIFT_create()` (more robust) or `cv2.ORB_create()` (faster) to find keypoints and descriptors.
    3.  **Feature Matching:** For adjacent frames (e.g., frame `i` and `i+1`), use `cv2.FlannBasedMatcher` or `cv2.BFMatcher` to find matching keypoints.
    4.  **Homography Estimation:** Use `cv2.findHomography` with the RANSAC algorithm to calculate the perspective transformation matrix between the two frames.
    5.  **Warping & Compositing:** Use `cv2.warpPerspective` to align one image to the other's coordinate system. Blend the images together using a feathering or multi-band blending technique to hide seams.
    6.  **Incremental Stitching:** Start with the first two frames to create a small mosaic. Then, match and warp the third frame onto that mosaic, and so on. This avoids a computationally expensive global bundle adjustment.

2.  **Georeferencing without RTK GPS:**
    *   The SRT file gives you the GPS coordinate of the drone (camera center) for each frame.
    *   After the entire mosaic is stitched in *pixel coordinates*, you have a large image and a set of transformations for each original frame.
    *   You can establish a "pixel-to-geo" transformation. A simple approach is to use an affine transformation calculated from three or more control points (i.e., the known GPS centers of three frames and their final pixel locations in the mosaic).
    *   The final output can then be saved as a GeoTIFF by embedding this transformation information.

3.  **Memory Management for Large Mosaics:**
    *   **Never load all 4K frames into RAM.** Process frames in pairs or small batches.
    *   **Use Image Pyramids:** Perform initial feature matching on low-resolution versions of the images to get a rough alignment, then refine the alignment on higher-resolution versions.
    *   **Disk-Based Mosaic:** As the mosaic grows beyond the available RAM (e.g., > 4GB), do not keep it in a single NumPy array. Write the composite to disk as a TIFF file and use a library like **`vips`** or memory-mapped files (`numpy.memmap`) to append new warped frames without loading the entire mosaic into memory.

4.  **Vessel/Obstacle Detection:**
    *   Once the final orthomosaic is generated on disk, run a sliding window or tile the image into manageable chunks (e.g., `1024x1024`).
    *   Feed each tile into an object detection model (like the YOLOv8 from Pipeline 1, but trained on boats and buoys) to find objects of interest.
    *   Convert the pixel coordinates of the detected objects back to GPS coordinates using the georeferencing information.

#### **Code Structure (Python)**

```
/project
|-- stitcher.py             # Main script to run the pipeline
|-- frame_extractor.py      # Extracts frames and parses SRT for geotags
|-- feature_matcher.py      # SIFT/ORB matching and homography logic
|-- warper.py               # Image warping and blending
|-- data/
|   |-- video.MP4
|   |-- video.SRT
|-- output/
|   |-- orthomosaic.tif     # The final stitched image
|   |-- detections.json     # List of detected vessels with GPS coordinates
```

---

### **PIPELINE 4: CATCH PREDICTION**

This is a classic tabular data problem. The model will be very small and fast, making it ideal for the Jetson's CPU.

| Specification | Value |
| :--- | :--- |
| **Model** | **XGBoost (Xtreme Gradient Boosting)** |
| **Architecture** | ~100 trees, max_depth=5 |
| **VRAM Usage** | **~0 GB** (CPU-only) |
| **Inference Latency** | **<1ms** |

#### **Detailed Breakdown**

1.  **Model Architecture:**
    *   **XGBoost** is the best choice. It's highly performant, memory-efficient, and excels at tabular data. A small neural network is overkill and harder to train.
    *   **Hyperparameters:** A good starting point would be `n_estimators=100`, `max_depth=5`, `learning_rate=0.1`. These can be tuned using cross-validation. The final model file will be very small (<1 MB).

2.  **Feature Engineering:**
    *   **Cyclical Features:** This is critical for time-based data.
        *   `time`: Convert to `sin(2*pi*hour/24)` and `cos(2*pi*hour/24)`.
        *   `moon_phase`: Convert to `sin(2*pi*phase/1)` and `cos(2*pi*phase/1)`.
        *   `season`: Convert to `sin(2*pi*month/12)` and `cos(2*pi*month/12)`.
    *   **Categorical Features:**
        *   `location`: If you have discrete named spots, use one-hot encoding.
    *   **Numerical Features:**
        *   `depth`, `temperature`, `tide`: Use as-is, but ensure they are scaled (e.g., using `StandardScaler`).
    *   **Historical Catches:** Create features like `avg_catch_last_7_days_at_location`.

3.  **Training Data Format (CSV):**
    ```csv
    timestamp,latitude,longitude,depth,temp,tide_height,moon_phase,season,catch_count
    2023-10-27 14:30:00,45.123,-68.456,15.5,12.2,1.8,0.75,3,5
    2023-10-27 14:35:00,45.124,-68.457,16.0,12.2,1.8,0.75,3,8
    ...
    ```
    *   The `catch_count` is your target variable. The output can be a regression (predicting the number) or a classification (predicting high/medium/low probability).

4.  **Inference:**
    *   The inference process is trivial. Load the trained XGBoost model file.
    *   Collect the current real-time features (depth, temp, time, etc.).
    *   Apply the *exact same* feature engineering transformations used in training.
    *   Call `model.predict()` on the single input vector. The latency is negligible.
    *   To recommend a spot, you can run inference on a predefined grid of potential fishing spots and return the one with the highest predicted catch probability.

#### **Code Structure (Python)**

```
/project
|-- train.py                # Loads CSV, engineers features, trains XGBoost model
|-- predict.py              # Loads model, takes live data, makes prediction
|-- feature_transformer.py  # Class/functions for consistent feature engineering
|-- model.json              # Saved XGBoost model
|-- data.csv                # Your historical catch log
```

---

### **PIPELINE 5: SPEECH-TO-TEXT FOR CAPTAIN VOICE COMMANDS**

This requires a model that is small, fast, and robust to the significant background noise of a marine environment.

| Specification | Value |
| :--- | :--- |
| **Model Name** | **NVIDIA Riva with Conformer-CTC** (or Whisper.cpp as a fallback) |
| **VRAM Usage** | **~1.5-2.0 GB** (for Riva) |
| **Latency** | **<300ms** on short commands (real-time streaming) |
| **Noise Robustness** | Excellent, trained on noisy datasets |

#### **Detailed Breakdown**

1.  **Model Name & Justification:**
    *   **Primary Recommendation: NVIDIA Riva.** Riva is a GPU-accelerated speech AI SDK specifically designed for NVIDIA hardware. It's the most performant and robust solution for a Jetson device. The Conformer-CTC models are state-of-the-art for noise robustness. Riva provides pre-trained models that can be deployed directly on the Jetson.
    *   **Fallback: Whisper.cpp.** If Riva is too complex to set up, `whisper.cpp` is a great CPU-based alternative. Use the `ggml-tiny.en-q5_1.bin` model. It's a 5-bit quantized version of the tiny English model. It will run entirely on the Orin Nano's ARM CPU, freeing up the GPU for other tasks, but latency will be higher (~500-800ms).

2.  **VRAM Usage & Latency (Riva):**
    *   Riva's ASR service, when loaded, will consume a significant chunk of the shared memory, around 1.5-2.0 GB.
    *   However, because it's GPU-accelerated, the latency for transcribing short commands (e.g., "set course to waypoint three") will be very low, well under the threshold for real-time interaction.

3.  **Noise Robustness:**
    *   Riva's models are trained on thousands of hours of data, including noisy samples, making them inherently robust.
    *   For a custom solution, you would need to perform **data augmentation**. Record clean voice commands and use a tool like `ffmpeg` to programmatically mix them with recorded audio from your boat (engine hum, wind, water splashing) at various signal-to-noise ratios. This is essential for making any model, including a fine-tuned one, work well in the target environment.

4.  **Deployment Steps on Jetson (Riva):**
    1.  Install the Riva server on the Jetson Orin Nano using the provided ARM64 containers from NVIDIA's NGC catalog.
    2.  Download the pre-trained Conformer ASR model.
    3.  Configure and launch the Riva server. It will run as a background service.
    4.  Your Python application will act as a Riva client. It captures audio from the microphone, streams it to the local Riva server, and receives the transcribed text back.

#### **Code Structure (Python with Riva Client)**

```
/project
|-- main.py                 # Main application, calls command_listener
|-- command_listener.py     # Captures audio, streams to Riva, gets transcription
|-- command_parser.py       # Takes transcribed text and executes actions
|-- config.py               # Riva server address (localhost)
# (Riva server runs in a separate Docker container)
```

This comprehensive breakdown provides a clear, actionable plan for implementing each pipeline on the Jetson Orin Nano 8GB, with specific attention to its unique architectural strengths and constraints.