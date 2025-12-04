// export default function NetworkBackground() {
//   return (
//     <div className="fixed inset-0 -z-10 overflow-hidden">
//       {/* 渐变背景 */}
//       <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50" />

//       {/* 软光晕 - 提升氛围深度 */}
//       <div className="absolute top-1/4 -left-1/4 w-[500px] h-[500px] rounded-full bg-blue-200/10 blur-3xl" />
//       <div className="absolute bottom-1/3 -right-1/4 w-[400px] h-[400px] rounded-full bg-purple-200/10 blur-3xl" />
//       <div className="absolute top-2/3 right-1/3 w-[350px] h-[350px] rounded-full bg-cyan-200/05 blur-3xl" />

//     </div>
//   );
// }
export default function NetworkBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* 自定义 Trackless 品牌渐变：左上淡紫 → 中心宽白区 → 右下柔粉 */}
      <div 
        className="absolute inset-0"
        style={{
          background: 
            'linear-gradient(135deg, ' +
            '#e0d6f0ff 0%, ' +
            '#f5edff 35%, ' +
            '#fefefeff 45%, ' +
            '#ffffff 55%, ' +
            '#fff5fb 65%, ' +
            '#ebd6e6ff 100%)',
        }}
      />

      {/* 软光晕组：颜色微调以匹配新背景，增强深度与科技感 */}
      {/* 左上：淡紫光晕（呼应加密/隐私） */}
      <div className="absolute top-1/4 -left-1/4 w-[500px] h-[500px] rounded-full bg-purple-200/15 blur-3xl" />
      
      {/* 右下：柔粉光晕（呼应激励/社区） */}
      <div className="absolute bottom-1/3 -right-1/4 w-[400px] h-[400px] rounded-full bg-pink-200/15 blur-3xl" />
      
      {/* 右中：极淡紫灰点缀（增加层次，不抢眼） */}
      <div className="absolute top-2/3 right-1/3 w-[350px] h-[350px] rounded-full bg-violet-200/10 blur-3xl" />
    </div>
  );
}