interface EditorialModalCloseButtonProps {
  ariaLabel: string;
  onClick: () => void;
}

export default function EditorialModalCloseButton({
  ariaLabel,
  onClick,
}: EditorialModalCloseButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="text-[#8a837a] transition-colors duration-300 hover:text-[#2a2520] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5c564e]"
    >
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  );
}
