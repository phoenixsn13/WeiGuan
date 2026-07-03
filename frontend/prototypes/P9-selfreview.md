# P9 多平台原型自审

## 资产

- `multiplatform-live.png`
  - 来源：`/home/sunrise/workspace/profiles/codex/generated_images/019f1bbe-1fd1-7990-8383-2538df4424fd/ig_0119b421585aebfa016a4723bc58e881919bea0d90b14797dd.png`
  - 用途：多平台并列 Live、世界时钟、跨平台桥接线、移动端预览。
- `skins-compare.png`
  - 来源：`/home/sunrise/workspace/profiles/codex/generated_images/019f1bbe-1fd1-7990-8383-2538df4424fd/ig_00b0642ab3a79a6c016a47262bd438819190b0d96dfaa7efba.png`
  - 用途：同一讨论内容在微博、X、Reddit 三种平台表现下的桌面与移动端对比。

## 自审结论

- 皮肤可辨：通过。微博使用暖色话题与互动，X 使用冷色轻量信息流，Reddit 使用投票、楼层和讨论串。
- 共享内容：通过。三列使用同一主帖和相近回复内容，表达“同一内容，不同平台表现”。
- 桥接关系：通过。多平台 Live 图中用冷靛蓝连线表示平台间外溢路径，未使用默认图表配色。
- 桌面与移动：通过。两张图均包含桌面形态，且补充移动端预览。
- 心智词表：部分通过。`multiplatform-live.png` 左侧仍有“世界地图”“配置中心”等偏后台词，仅作为布局参考；Task 5/6 实现不得出现这些词。
- 文案语言：部分通过。`skins-compare.png` 的 Reddit 区域保留少量原生英文控件词，最终实现按产品语言策略处理，前台解释性文案保持中文。

## 实现约束

- 最终前端必须以同一 `PosterView` 数据契约驱动三种平台皮肤，只改变展示组件。
- 多平台连接线使用冷靛蓝，不使用默认图表色。
- 用户界面避免“仿真工作台”“配置中心”“后端”“模型”等后台或技术心智词。
- 多平台 Live 的移动端优先保留核心阅读体验，桥接关系可收敛为摘要而不是强行画复杂连线。
