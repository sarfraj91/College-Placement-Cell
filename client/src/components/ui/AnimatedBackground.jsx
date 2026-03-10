// eslint-disable-next-line no-unused-vars
import { motion } from "framer-motion";

const AnimatedBackground = () => {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      {/* Blob 1 */}
      <motion.div
        className="absolute top-[-10%] left-[-10%] w-160 h-160
                   bg-indigo-200/30 rounded-full blur-3xl"
        animate={{
          x: [0, 80, -40, 0],
          y: [0, 60, -30, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Blob 2 */}
      <motion.div
        className="absolute bottom-[-10%] right-[-10%] w-[35rem] h-[35rem]
                   bg-blue-200/30 rounded-full blur-3xl"
        animate={{
          x: [0, -70, 40, 0],
          y: [0, -50, 30, 0],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Blob 3 */}
      <motion.div
        className="absolute top-[30%] right-[20%] w-[25rem] h-[25rem]
                   bg-sky-200/20 rounded-full blur-3xl"
        animate={{
          x: [0, 40, -40, 0],
          y: [0, -40, 40, 0],
        }}
        transition={{
          duration: 26,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
};

export default AnimatedBackground;
