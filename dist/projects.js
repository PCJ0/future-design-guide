(()=>{
const C=window.LAB_CONTENT;
C.projects=[
 {title:'汉服的挖掘与创新',image:'assets/lab-case-hanfu.png',caption:'综合案例汇总 · 第66页',text:'团队为传统服饰知识学习工具探索 AI 设计方法，资料列出裙高、面料厚薄、袖宽和飘带系法等汉服特征。图片展示生成式汉服款式。',aliases:['汉服','汉元素','传统服装','汉服AI']},
 {title:'云衣智能时尚设计系统',image:'assets/lab-case-cloud-clothing.png',caption:'综合案例汇总 · 第14–19页',text:'云衣围绕服饰设计展示服装解析、款式与面料生成、虚拟试衣和多模态检索等能力。材料中的数量指标按演示稿口径介绍。',aliases:['云衣','服装设计','服饰设计','虚拟试衣']},
 {title:'Product AI 智能设计系统',image:'assets/lab-case-product-ai.png',caption:'综合案例汇总 · 第21页',text:'Product AI 是创新设计数智平台中的智能产品设计工具案例。',aliases:['Product AI','产品AI']},
 {title:'Chat2Design 智能体设计系统',image:'assets/lab-case-product-ai.png',caption:'综合案例汇总 · 第22页',text:'Chat2Design 展示对话式智能体与设计任务结合的工具方向。',aliases:['Chat2Design','对话式设计']},
 {title:'多模态感知数智平台',image:'assets/lab-case-multimodal-sensing.png',caption:'综合案例汇总 · 第23–26页',text:'平台案例覆盖智慧城市、社区与交通感知，涉及视觉识别、边缘计算和数据分析。不同场景的试验与部署状态需分别确认。',aliases:['多模态感知','智慧城市','智慧社区']},
 {title:'智慧交通解决方案',image:'assets/lab-case-traffic.png',caption:'综合案例汇总 · 第25页',text:'资料称系统已在嘉善公安局测试环境部署，围绕雾计算和算力调度开展设计；这不表示已经全面上线。',aliases:['智慧交通','交通管理','嘉善公安局']},
 {title:'未来社区多模态视觉识别',image:'assets/lab-case-multimodal-sensing.png',caption:'综合案例汇总 · 第26页',text:'展示打架斗殴、违规横幅、消防通道占用、电动车进电梯、危险攀爬、乱倒垃圾和烟雾报警等复杂场景识别。演示稿中的测试数据不是网页独立验证结果。',aliases:['未来社区','社区视觉识别','消防通道','电动车进电梯']},
 {title:'政策大脑与惠企政策服务',image:'assets/lab-case-enterprise-knowledge.png',caption:'综合案例汇总 · 第27–31页',text:'围绕政策检索与解读、企业资料解析、政策匹配、申报评估和问答等场景提供知识服务方案。',aliases:['政策大脑','惠企政策','政策匹配']},
 {title:'中国电信全球舆情态势分析',image:'assets/lab-case-enterprise-knowledge.png',caption:'综合案例汇总 · 第34–35页',text:'案例通过全球信息抓取、事件识别和态势分析，为研判、预警及辅助决策提供信息线索。',aliases:['全球舆情','舆情大模型','中国电信']},
 {title:'祥符光影艺术季',image:'assets/lab-case-xiangfu-light.png',caption:'综合案例汇总 · 第35–39页',text:'以秋日、童年记忆和未来想象为主题，结合光影与互动科技设计沉浸式艺术体验。',aliases:['祥符光影艺术季','祥符荡','光影艺术']},
 {title:'遇见苏东坡沉浸式光影艺术展',image:'assets/lab-case-sudongpo.png',caption:'综合案例汇总 · 第40–45页',text:'以苏轼文化符号为线索，结合沉浸式光影、商业空间和数字内容，探索传统文化的当代表达。',aliases:['遇见苏东坡','苏东坡','沉浸式光影']},
 {title:'南湖滨水与子城光影方案',image:'assets/lab-case-sudongpo.png',caption:'综合案例汇总 · 第46–48页',text:'展示高邮清水潭“心弦”、南湖滨水和子城光影方案，探索城市文化空间的数字艺术表达。',aliases:['南湖光影','子城光影','高邮清水潭']},
 {title:'iFS离子精筛膜与咸水淡化',image:'assets/lab-case-ion-membrane.gif',caption:'综合案例汇总 · 第50–51页',text:'资料介绍离子精筛膜的筛分原理，并展示盐碱水淡化、生产线和家用净水设备等应用方向。技术性能和项目状态需以检测及最新项目材料确认。',aliases:['离子精筛膜','iFS','盐碱水淡化','净水设备']},
 {title:'智能农机装备与无人配送',image:'assets/lab-case-smart-agriculture.png',caption:'综合案例汇总 · 第52页',text:'关注柔性水果采摘与分选设备、无人配送车，以及机器人、无损检测、自主导航等装备技术。',aliases:['智能农机','智慧农业','水果采摘','水果分选','无人配送车']},
 {title:'吉利汽车 AIGC 设计',image:'assets/lab-case-geely-aigc.png',caption:'综合案例汇总 · 第55–56页',text:'演示稿展示吉利汽车 AIGC 设计实践和视觉方案。',aliases:['吉利汽车','吉利AIGC','汽车设计']},
 {title:'钱江摩托 AIGC 设计',image:'assets/lab-case-qianjiang-motor.jpeg',caption:'综合案例汇总 · 第57页',text:'演示稿展示钱江摩托 AIGC 设计案例图像。',aliases:['钱江摩托','摩托车设计','摩托AIGC']},
 {title:'海尔 AIGC 项目',image:'assets/lab-case-haier-aigc.jpeg',caption:'综合案例汇总 · 第58页',text:'演示稿展示海尔 AIGC 项目视觉案例，未注明项目当前阶段。',aliases:['海尔','家电AIGC']},
 {title:'服装 AIGC 生成与营销',image:'assets/lab-case-cloud-clothing.png',caption:'综合案例汇总 · 第60–65页',text:'案例涵盖款式生成与测款、模特形象生成，以及服装图像识别和打版线稿转换。',aliases:['服装AIGC','款式生成','AI模特','服装线稿']},
 {title:'AIGC 配饰与黄金饰品设计',image:'assets/lab-case-gold-accessories.png',caption:'综合案例汇总 · 第69–71页',text:'展示配饰与黄金饰品的智能设计、风格转换和效果图方案。时间指标属于演示稿口径。',aliases:['配饰设计','黄金饰品','珠宝设计','首饰生成']},
 {title:'三星堆 AI 文创产品设计',image:'assets/lab-case-sanxingdui.png',caption:'综合案例汇总 · 第72页',text:'将三星堆文化与文创产品概念结合，展示 AI 辅助生成创意灵感的案例。',aliases:['三星堆','AI文创','文创设计']},
 {title:'AI CMF 与服装面料纹样',image:'assets/lab-case-aicmf.png',caption:'综合案例汇总 · 第74–76页',text:'展示颜色、材料、工艺与服装面料纹样的 AI 设计表达。',aliases:['CMF','AICMF','面料纹样','服装面料']},
 {title:'AIGC 社媒短视频与种草视频生成',image:'assets/lab-case-social-video.png',caption:'综合案例汇总 · 第80–83页',text:'展示社交媒体短视频和产品种草内容的生成流程与效果。',aliases:['短视频生成','种草视频','社媒视频','营销视频']},
 {title:'AI 地毯图案设计',image:'assets/lab-case-haier-aigc.jpeg',caption:'综合案例汇总 · 第85–94页',text:'连续展示 AI 地毯纹样与图案设计案例。',aliases:['地毯设计','地毯图案','AI图案设计']},
 {title:'吉利汽车品牌战略与品牌出海',image:'assets/lab-case-geely-aigc.png',caption:'综合案例汇总 · 第96–103页',text:'展示吉利汽车品牌战略规划、文化传播和品牌出海视觉设计内容。',aliases:['品牌出海','吉利品牌战略','品牌传播']},
 {title:'竹编纸模设计与制作',image:'assets/lab-case-bamboo-paper.png',caption:'未来设计实验室介绍0617 · 第106–110页',text:'竹编纸模根据输入纹样计算孔位并输出刀版图，用一次性打孔纸模辅助竹编制作。材料记载该项目获得 2024 中国设计智造大奖（DIA）佳作奖，2025 年被厦门红点博物馆收藏，并称已确定安吉推广单位。',aliases:['竹编纸模','竹编','非遗竹编','纸模软件']},
 {title:'儿童读写障碍评估与干预应用',image:'assets/lab-case-reading-intervention.gif',caption:'未来设计实验室介绍0617 · 第111–126页',text:'研究成果包括音乐辅助训练、拼音与阅读关卡、字理识字和汉字部件结构练习等。它是研究与应用案例介绍，不替代专业评估或治疗。',aliases:['儿童读写障碍','读写困难','阅读障碍干预','儿童阅读康复']},
 {title:'创新设计数智平台与数据智能',image:'assets/lab-data-engine.png',caption:'未来设计实验室介绍0617 · 第9–13页',text:'平台架构包括设计数据资产、生成式设计、多模态知识服务、商业空间计算和视觉感知等工具链，面向服装、城市、文旅和农业等领域。',aliases:['创新设计数智平台','设计数据','数据智能','多模态知识服务']},
 {title:'智慧商圈客流与开店评估',image:'assets/lab-case-smart-district.png',caption:'综合案例汇总 · 第17–19页',text:'展示门店进出识别、去重客流计数、人群画像和开店评估等商圈分析场景。演示稿的准确率数据需按原资料口径理解。',aliases:['智慧商圈','门店客流','客流计数','开店评估']},
 {title:'智慧政工人员关系图谱',image:'assets/lab-case-police-training.png',caption:'综合案例汇总 · 第50–51页',text:'整合履历与关联信息构建警务人员数字档案和关系网络，用于内部管理、协同与风险识别。材料称该案例已部署省公安厅。',aliases:['智慧政工','公安关系图谱','警务人员档案','省公安厅']},
 {title:'交警综合治理平台',image:'assets/lab-case-traffic.png',caption:'综合案例汇总 · 第52–54页',text:'围绕交通隐患发现、排查、派单和处理闭环，展示交警综合治理平台。演示稿注明部分子功能正在开发、智能模块推进中。',aliases:['交警综合治理','交通治理平台','交通隐患排治']},
 {title:'110 接警时空预测',image:'assets/lab-case-traffic.png',caption:'综合案例汇总 · 第55–56页',text:'基于历史接警数据展示时序预测、地区和类型报表，以及面向数据的检索问答。',aliases:['110接警预测','警情预测','案件时空预测']},
 {title:'AI 城市大数据预警平台',image:'assets/lab-case-multimodal-sensing.png',caption:'综合案例汇总 · 第57–59页',text:'展示治安要素融合、风险预警分类、趋势研判和可视化处置看板。',aliases:['城市大数据预警','治安预警','预警看板']},
 {title:'企业大模型智能体服务系统',image:'assets/lab-case-enterprise-knowledge.png',caption:'综合案例汇总 · 第60–64页',text:'面向企业知识与业务流程，展示采购供应商、招商活动、客诉舆情等智能助手场景。',aliases:['企业智能体','采购助手','供应商管理','招商助手','客诉舆情']}
];
C.gallery.push(...C.projects.map(p=>({title:p.title,caption:p.caption,image:p.image,description:p.text,project:true})));
C.gallery.push(
 {title:'iFS 离子精筛膜工作原理',caption:'综合案例汇总 · 第50页',image:'assets/lab-case-ion-membrane.png'},
 {title:'竹编纸模项目荣誉展示',caption:'未来设计实验室介绍0617 · 第109页',image:'assets/lab-case-bamboo-award.jpeg'}
);
C.clips.push(
 {title:'警校射击培训视频教学与纠错',caption:'综合案例汇总 · 第15页，视频教学和动作纠错演示。',src:'assets/lab-video-police-training.mp4',poster:'assets/lab-case-police-training.png'},
 {title:'智慧商圈进出门店识别',caption:'综合案例汇总 · 第18页，统计进入门店区域的人数。',src:'assets/lab-video-store-entry.mp4',poster:'assets/lab-case-smart-district.png'},
 {title:'智慧商圈门店客流分析',caption:'综合案例汇总 · 第18页，门店客流计数与运营分析演示。',src:'assets/lab-video-store-footfall.mp4',poster:'assets/lab-case-smart-district.png'},
 {title:'中国电信全球舆情分析演示',caption:'综合案例汇总 · 第34–35页，全球信息与事件态势分析案例。',src:'assets/lab-video-telecom-analysis.mp4',poster:'assets/lab-case-enterprise-knowledge.png'},
 {title:'AIGC 产品营销视频生成',caption:'综合案例汇总 · 第40页，产品图像和营销视频生成案例。',src:'assets/lab-video-ai-product-promo.mp4',poster:'assets/lab-case-product-ai.png'},
 {title:'服装设计生成演示一',caption:'未来设计实验室介绍0617 · 第81页，社媒场景服装视频生成。',src:'assets/lab-video-fashion-generation-1.mp4',poster:'assets/lab-case-social-video.png'},
 {title:'服装设计生成演示二',caption:'未来设计实验室介绍0617 · 第81页，社媒场景服装视频生成。',src:'assets/lab-video-fashion-generation-2.mp4',poster:'assets/lab-case-social-video.png'},
 {title:'社媒种草视频生成演示一',caption:'未来设计实验室介绍0617 · 第82页，生成种草视频。',src:'assets/lab-video-social-promo.mp4',poster:'assets/lab-case-social-video.png'},
 {title:'社媒种草视频生成演示二',caption:'未来设计实验室介绍0617 · 第83页，生成种草视频。',src:'assets/lab-video-social-promo-2.mp4',poster:'assets/lab-case-social-video.png'},
 {title:'社媒种草视频生成演示三',caption:'未来设计实验室介绍0617 · 第83页，生成种草视频。',src:'assets/lab-video-social-promo-3.mp4',poster:'assets/lab-case-social-video.png'},
 {title:'儿童读写障碍干预研究成果视频一',caption:'未来设计实验室介绍0617 · 第114–115页，研究成果演示。',src:'assets/lab-video-reading-system-1.mp4',poster:'assets/lab-case-reading-app.png'},
 {title:'儿童读写障碍干预研究成果视频二',caption:'未来设计实验室介绍0617 · 第122页，研究成果演示。',src:'assets/lab-video-reading-system-2.mp4',poster:'assets/lab-case-reading-app.png'},
 {title:'儿童读写障碍干预研究成果视频三',caption:'未来设计实验室介绍0617 · 第124页，研究成果演示。',src:'assets/lab-video-reading-system-3.mp4',poster:'assets/lab-case-reading-app.png'},
 {title:'儿童读写障碍干预研究成果视频四',caption:'未来设计实验室介绍0617 · 第125页，研究成果演示。',src:'assets/lab-video-reading-system-4.mp4',poster:'assets/lab-case-reading-app.png'}
);
})();
