import FadeIn from './FadeIn';

interface AnimatedDividerProps {
  className?: string;
  delay?: number;
  once?: boolean;
}

export default function AnimatedDivider({
  className = 'mb-4 h-1 w-20 bg-zion-accent',
  delay = 0,
  once = true,
}: AnimatedDividerProps) {
  return (
    <FadeIn className={className} delay={delay} once={once} direction="none">
      <span aria-hidden="true" />
    </FadeIn>
  );
}
