import styles from './HomeSections.module.css';

type SectionHeadingProps = {
  /** Referenced by the section's aria-labelledby. */
  id: string;
  title: string;
  subtitle?: string;
};

/** Figma section title: centered uppercase green heading, a short rule and an optional subtitle. */
export default function SectionHeading({ id, title, subtitle }: SectionHeadingProps) {
  return (
    <div className={styles.heading}>
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
      <span className={styles.rule} aria-hidden="true" />
      {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
    </div>
  );
}
