import { motion, useMotionValue, useAnimation } from "framer-motion";

export default function SwipeItem({ children, onDelete }: { children: React.ReactNode, onDelete: () => void }) {
  const x = useMotionValue(0);
  const controls = useAnimation();

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x < -120) {
      controls.start({ x: -300 });
      setTimeout(onDelete, 200);
    } else {
      controls.start({ x: 0 });
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete background */}
      <div className="absolute inset-0 bg-red-500 flex items-center justify-end pr-6">
        <span className="text-white font-medium">Delete</span>
      </div>

      {/* Foreground card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -300, right: 0 }}
        style={{ x }}
        animate={controls}
        onDragEnd={handleDragEnd}
        className="relative z-10 bg-neutral-900" // Ensure background hides delete area
      >
        {children}
      </motion.div>
    </div>
  );
}