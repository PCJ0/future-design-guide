# V4 素材与生成提示词

使用内置 image_gen（非 CLI/API）。生成后复制到本地工程，不依赖外部图片链接。图集透明边缘的零散像素由运行时连通区域清理；动作通过整帧切换播放，不做网格变形。

## guide-atlas-v4.png

位置：`dist/assets/guide-atlas-v4.png`。参考：原 robot-sprites.png。

Create production animation SPRITE ATLAS for the exact white cute blue-accent robot in reference (reference is identity only). Transparent background with real alpha, no shadows, no grid lines, no text. 3072x2048 PNG, EXACT 8 columns x 4 rows of equally sized cells. Exactly 32 isolated whole-body robots. Same orthographic camera, consistent body size and feet baseline per cell, 12% margin in every cell, no clipping. 3D polished render identical white shell, black face blue smiling eyes, single blue antenna, blue ear rings, D chest logo. NO deformed or stretched limbs. Row 1: eight consecutive distinct frames of a smooth full REAR VIEW walking cycle, pelvis rotation, alternating foot contacts, passing positions, opposite arm swing, no visible face. Row 2: eight consecutive distinct frames of a smooth full SIDE VIEW walking cycle toward SCREEN RIGHT. Row 3: eight consecutive turn-in-place frames going from REAR facing away, through RIGHT profile, to FRONT facing camera (frame 8 front neutral). Row 4: frames 1-4 FRONT view gesture lifting LEFT screen-side arm from resting to fully extending toward SCREEN LEFT (open palm); frames 5-8 FRONT view lifting RIGHT screen-side arm from resting to fully extending toward SCREEN RIGHT. Hands anatomically attached to shoulders with elbows and wrists, arm never merged with torso. Clearly different animation poses, feet and head stable, consistent size. This is a functional frame-by-frame game animation sheet, not a collage.

说明：生成结果第四行没有正确区分左右，因此左指动作采用下列独立图集，未使用镜像补丁。

## guide-left-v4.png

位置：`dist/assets/guide-left-v4.png`。参考：guide-atlas-v4.png。

Production sprite animation atlas, same exact robot identity as reference. TRUE transparent alpha background, 4 columns x 2 rows exactly, eight whole-body frames. All eight face FRONT, readable blue D chest emblem, blue antenna, black face smiling blue eyes, identical scale and position and ground baseline, broad safe margins, no clipping. Animate ONLY robot's anatomical RIGHT arm, on the VIEWER'S LEFT side of image, rising to point toward LEFT EDGE OF IMAGE. Do NOT raise the hand on image right. Sequence in reading order: frame1 both hands down; frame2 viewer-left elbow bends slightly; frame3 viewer-left arm half lifted; frame4 viewer-left arm fully extended horizontally toward LEFT edge open palm; frame5 holds same LEFT pointing pose with wrist slightly up; frame6 viewer-left arm half lowered; frame7 viewer-left arm nearly down; frame8 both hands down. Other hand stays down throughout. Keep the body, front-facing head and legs stable. Chest D is normally oriented, not mirrored. Polished white-shell 3D robot from reference, anatomically attached joints, no stretching, no shadows or text or gridlines. Transparent background, not white rectangle.

## intro-empty-v4.png

位置：`dist/assets/intro-empty-v4.png`。参考：用户最后一张简洁大厅图。

Precise object edit. Remove ONLY the central robot and its shadow/reflection from this empty architectural interior. Reconstruct uninterrupted marble floor and distant window underneath. Preserve exact architecture, empty minimal side walls, lighting, perspective, mountains and 16:9 composition. No robots, plants, flowerbeds, exhibits, text, UI or new objects. This is the clean background layer for a moving guide.

## gallery-panorama-v4.png

位置：`dist/assets/gallery-panorama-v4.png`。参考：用户展厅一、二、三设计图。

Create one SEAMLESS CONTINUOUS architectural exhibition panorama inspired by the three reference halls in order left to right. 3072x1024 very wide 3:1. One continuous marble floor horizon and same eye-level camera, NO panels dividing the image, not a collage. Simplify heavily, elegant warm ivory stone, soft daylight, thin champagne light strips, very few objects, no plants or flowerbeds, no busy scenery. Left third: design achievements, sculptural wood chair and a white household product on low clean plinths. Middle third: AI innovation, central translucent blue technical wireframe compact vehicle exhibit with two understated slim touch kiosks. Right third: creative practice, pristine wood model and desktop 3D printer on one clean ivory workshop table. All exhibits midground between 40% and 70% image height. Top 35% mostly beautiful plain warm ivory architecture with empty walls for HTML titles. Bottom 28% uninterrupted clean reflective walkway for animated robot. Preserve architectural mood and quality of references but remove ALL robots, people, text, numbers, brands, signage, microphones, UI, trees, dense posters, tiny objects. Three exhibition islands in one real continuous room, generous breathing room, sophisticated restrained museum visualization.

# V5 素材

使用内置 image_gen 编辑/生成后存入 dist/assets/；本地网站本身不调用生成 API。以下记录各图的制作要求，旧 V4 图集继续复用。

- `idle-v5.png`：以原待机背景为基准，去掉下方麦克风、波形与唤醒文字，保持品牌、暖色展馆和地面；不加入机器人。
- `choice-v5.png`：以二选一场景为基准，去掉麦克风、蓝色波形与控件；保留展台建筑，不加入机器人。
- `overview-v5.png`：并排两幅等宽、暖白金色、精致等轴测展陈插画。左侧将设计座椅、家电、阀门、精密制造通过路径连接；右侧连接 AI、用户、设计知识、模型和实践。没有文字，供网页分栏使用。
- `details-v5.png`：3×3 等尺寸产品展陈图集。依次为人体工学座椅与家电、爆炸阀门与机械臂、循环材料与模块灯及风机、设计草图与产品、爆炸车辆、材料库与工厂及平板、创意草图与纸模、木模型与工具、三维打印机与镂空花瓶及 CAD。暖白石材展馆，精致真实产品，画面简洁，无文字与机器人。
- `lounge-v5.png`：根据用户访谈参考图，移除机器人及其椅子、全部文字和波形，保留暖色洽谈空间、窗、前景沙发与茶几，供独立坐姿角色叠加。
- `seated-v5.png`：透明 4×2 逐帧图集，保留小 D 的白色外壳、蓝色天线与耳环、黑色屏幕和蓝色眼睛，坐在米白扶手椅上；第一行倾听、点头、眨眼，第二行自然说话与抬手；固定相机、统一角色比例和椅子基线、完整身体、不变形、无背景文字。


# V6 动作素材（内置 image_gen）

保存路径：dist/assets/motion-v6.png、dist/assets/seated-v6.png。图集为 8×4 共 32 帧；由内置工具生成，未使用 CLI 或网站运行时 API。以 V4 机器人与 V5 坐姿为身份参考。透明图层由运行时取帧、连通区域清理与基线对齐；不修改肢体比例。

## motion-v6.png 提示词

Production sprite atlas, EXACT 8 columns x 4 rows, equal cells, 3072x2048 or higher. Reference only for robot identity. Transparent alpha, no background, no grid or text. Same cute white small robot, black face with blue happy eyes, blue single antenna and ear circles, blue D chest. Consistent camera, body proportions, scale and floor registration in every cell, margin all around. First TWO rows comprise SIXTEEN distinct consecutive frames of one fluid SIDE VIEW walking cycle traveling SCREEN RIGHT: clear contact, down, passing, up poses, alternating knees and ankles, natural opposite arm swing, subtle body sway, both feet and hands always intact. Third row: EIGHT sequential rear-view walking frames, looking fully away, no face visible, alternating steps. Fourth row: EIGHT sequential front-facing pointing poses slowly raising robot's SCREEN RIGHT arm from neutral to shoulder height with elbow gently bent, open palm; stable legs. Fine subtle incremental pose changes, physically connected limbs, no stretch, no squash, no motion blur. Each cell contains exactly one entire robot, no shadow outside character. All 32 cells regular same dimensions.

## seated-v6.png 提示词

Create animation production sprite atlas based on reference robot and ivory armchair identity. EXACT 8 columns x 4 rows, 32 equal cells, 3072x2048 or higher. Transparent alpha background. Fixed camera, identical scale, armchair fixed position and floor baseline in EVERY cell, generous margins, no clipping. Row1 and row2 together: 16 sequential subtle distinct frames of this robot lowering itself into this chair: first frame standing directly in front of chair with knees straight, gradually bending knees and hips, hands touching armrests, then settling seated upright at frame16. Chair present identical in every frame. Row3: eight sequential subtle nod/listen frames, seated with hands on knees, slight head dip then return, gentle eye blink. Row4: eight sequential speaking gesture frames, seated raising screen-right open palm gradually, holding then relaxing slightly. Preserve exact cute white blue robot with D chest, black face, blue smile eyes, blue antenna. Smooth close incremental differences between frames, no repeated static row. Entire robot and chair in every cell; no text, no panels, no shadows outside silhouette. This is usable animation frame atlas, not a storyboard.


# V8（内置 image_gen）

保存：dist/assets/idle-v8.png、dist/assets/sit-separated-v8.png。素材进入本地项目，网站本身不调用图像 API。

## idle-v8.png

历史素材提示词（当前首页已改用 `intro-empty-v4.png` 与网页文字标题）。保留左上品牌“未来设计实验室”，主标题也使用“未来设计实验室”；删除旧场馆名称和副标题。建筑、地面、展品、窗户、植物和灯光保持不变，不加入机器人、面板或按钮。

## sit-separated-v8.png

Create a compositing animation asset atlas, exact 3 columns x 3 rows, nine equal square cells, transparent alpha, no text. Reference for exact robot identity and beige armchair. CELL 1 (top left): ONLY one EMPTY beige round armchair, NO ROBOT. CELLS 2 through 9: ONLY THE ROBOT, NO CHAIR whatsoever, NO furniture. Eight incremental frames of robot sitting down onto an INVISIBLE seat: starts upright standing, then slight knee bend, then deeper knees and hips, then lowering pelvis, then seated with thighs horizontal and shins angled down, ends relaxed seated hands on thighs smiling front three-quarter camera. Match exact white shell blue antenna blue ears black face blue eyes D chest from reference. All robot frames same camera, same head/body scale and same feet baseline, fully visible with 12 percent margins. Chair rendered at correct matching scale for robot to be composited over, but exists ONLY in first cell. Critical: do not include chairs behind robots. Single empty chair cell plus eight isolated robots. Smooth restrained sitting action, no squashing, no clipping.
