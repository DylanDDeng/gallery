type LegalSection = {
  heading: string;
  paragraphs?: string[];
  items?: string[];
};

type LegalSectionsProps = {
  sections: LegalSection[];
};

export default function LegalSections({ sections }: LegalSectionsProps) {
  return (
    <>
      {sections.map((section, index) => (
        <section key={index}>
          <h2 className="mb-3 text-lg font-semibold text-[#141210] dark:text-[#e0d9ce]">
            {section.heading}
          </h2>
          {section.paragraphs && section.paragraphs.length > 0 ? (
            <div className="space-y-3 text-[15px] leading-relaxed text-[#4a443c] dark:text-[#8a837a]">
              {section.paragraphs.map((paragraph, paragraphIndex) => (
                <p key={paragraphIndex}>{paragraph}</p>
              ))}
            </div>
          ) : null}
          {section.items && section.items.length > 0 ? (
            <ul className="space-y-3 text-[15px] leading-relaxed text-[#4a443c] dark:text-[#8a837a]">
              {section.items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </>
  );
}
