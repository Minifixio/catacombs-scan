# Paris catacombs scan using an iPhone 14 LiDAR

You can find the project poster here :
- [English version](previews/project-poster-en.png) (EN)
- [Version française](previews/project-poster-fr.png) (FR)

You can find the project explanation slides here :
- [English version](previews/project-slides-en.png) (EN)
- [Version française](previews/project-slides-fr.png) (FR)



## Project steps
### 1. Manual scans of 3D data
Using the Lidar sensor and the cameras of an iPhone and the Polycam application.

### 2. Treatment and fusion of 3D scans
Assembly of scans on CloudCompare, cleaning on Meshlab, rendering and compression on Blender.

### 3. Creation of a visualization Webapp
Coded in Three.js to explore and analyze the Catacombs network and the surrounding places.

|  |  |  |
|--|--|--|
![Merge between catacombs and actual map](previews/preview-13.png) Merge between catacombs and actual map | ![Independent scans exploration](previews/preview-14.png) Independent scans exploration | ![FPV view and controls](previews/preview-11.png) FPV view and controls

### 4. Implementation of a VR visit of scans
Using an OCULUS Quest VR headset and the Sketchfab platform to configure the 3D scene.

![Oculus view](previews/preview-12.png)



## Project progress
### 1. Manual scans

|  |  |
|---|---|
![](previews/preview-1.png) | ![](previews/preview-2.png)

Specific equipment:
- iPhone equipped with a lidar
- Polycam app
- Scan support equipped with battery lamps 
- physical landmark

|  |  |
|---|---|
![](previews/preview-5.png) Polycam scan | ![](previews/preview-4.png) Polycam settings


### 2. Scans processing
Steps :
- Alignment and fusion with CloudCompare
- Cleaning and filling with Meshlab
- Remailing and rendering with Blender

|  |  |  |
|---|---|---|
![CloudCompare](previews/preview-6.png) CloudCompare | ![MeshLab](previews/preview-7.png) MeshLab | ![Blender](previews/preview-8.png) Blender

*8 merged scans, >4M of triangles on all scans & 5 3D formats treated: .glb, .obj., .Ply, .las and .xyz*


### 3. 3D visualization of the surface and the basement
- 3D reconstruction of tracks and buildings on blender from satellite images, SRTM elevation data and OSM requests
- Fusion and display on a website of surface data and 3D scans

Plugin used : [BlenderGIS](https://github.com/domlysz/BlenderGIS)

|  |  |
|---|---|
![](previews/preview-9.png) | ![](previews/preview-10.png)



## Contributing

### Requirements
This project relies on [Three.js](https://threejs.org/) and [Vite](https://vitejs.dev/)

### Running locally

Clone the project :
```
git clone https://gitlab.com/minifixio/catacombs-scan.git
```

Install required packages :
```
npm install
```

Run the app in *staging* mode :
```
npx vite --mode staging
```