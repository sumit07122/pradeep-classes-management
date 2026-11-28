import React from "react";

export interface AnimatedLoginMascotProps {
  isEmailFocused: boolean;
  isPasswordFocused: boolean;
  showPassword: boolean;
  hasPassword?: boolean;
  textLength?: number;
  className?: string;
}

export const AnimatedLoginMascot: React.FC<AnimatedLoginMascotProps> = ({
  isEmailFocused,
  isPasswordFocused,
  showPassword,
  hasPassword = false,
  textLength = 0,
  className = "",
}) => {
  // Determine gaze offset for eyes
  let pupilOffsetX = 0;
  let pupilOffsetY = 0;

  // The password state is active if the field is focused, has text, or show password is on
  const isPasswordActive = isPasswordFocused || (hasPassword && !isEmailFocused) || showPassword;

  if (isPasswordActive) {
    if (showPassword) {
      // Peeking down curiously at the revealed password
      pupilOffsetX = -2.5;
      pupilOffsetY = 4.5;
    } else {
      // Eyes covered
      pupilOffsetX = 0;
      pupilOffsetY = 0;
    }
  } else if (isEmailFocused) {
    // Look down and track typing length
    const clampedLength = Math.min(Math.max(textLength, 0), 28);
    pupilOffsetX = (clampedLength / 28) * 8 - 4; // -4px to +4px
    pupilOffsetY = 4.2;
  }

  // Determine Paw Transforms
  // Idle position: resting at bottom
  // Masked position: both paws covering eyes snugly
  // Peek position: left covers eye, right lowers and tilts so right eye peeks!
  let leftPawTransform = "translate(0px, 0px)";
  let rightPawTransform = "translate(0px, 0px)";

  if (isPasswordActive) {
    if (showPassword) {
      // Left paw covers left eye
      leftPawTransform = "translate(0px, -60px) rotate(-6deg)";
      // Right paw drops down and tilts away so right eye peeks clearly!
      rightPawTransform = "translate(24px, -16px) rotate(32deg)";
    } else {
      // Both paws cover eyes ("No peeking!")
      leftPawTransform = "translate(0px, -60px) rotate(-6deg)";
      rightPawTransform = "translate(0px, -60px) rotate(6deg)";
    }
  }

  return (
    <div
      className={`relative flex justify-center items-end select-none pointer-events-none ${className}`}
      style={{ height: "140px", overflow: "visible" }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 200 170"
        className="w-48 h-40 drop-shadow-md overflow-visible"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="bearCoat" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#a77048" />
            <stop offset="100%" stopColor="#7e4c27" />
          </radialGradient>
          <linearGradient id="capGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1a466f" />
            <stop offset="100%" stopColor="#102f50" />
          </linearGradient>
          <filter id="pawShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="2" floodColor="#102f50" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* 1. Bear Ears */}
        {/* Left Ear */}
        <g className="transition-transform duration-300" style={{ transformOrigin: "52px 50px" }}>
          <circle cx="52" cy="50" r="20" fill="url(#bearCoat)" stroke="#5c3519" strokeWidth="2.5" />
          <circle cx="52" cy="50" r="11" fill="#f4b942" opacity="0.9" />
        </g>
        {/* Right Ear */}
        <g className="transition-transform duration-300" style={{ transformOrigin: "148px 50px" }}>
          <circle cx="148" cy="50" r="20" fill="url(#bearCoat)" stroke="#5c3519" strokeWidth="2.5" />
          <circle cx="148" cy="50" r="11" fill="#f4b942" opacity="0.9" />
        </g>

        {/* 2. Bear Head Body */}
        <circle
          cx="100"
          cy="96"
          r="48"
          fill="url(#bearCoat)"
          stroke="#5c3519"
          strokeWidth="2.5"
        />

        {/* 3. Academic Scholar Graduation Cap (Pradeep Classes Colors) */}
        <g
          className="transition-transform duration-300 ease-out"
          style={{
            transformOrigin: "100px 36px",
            transform: isPasswordFocused
              ? "translateY(-2px) rotate(1deg)"
              : isEmailFocused
              ? "translateY(1px) rotate(-1deg)"
              : "none",
          }}
        >
          {/* Cap Skull Base */}
          <path
            d="M 72 40 Q 100 32 128 40 L 124 50 Q 100 54 76 50 Z"
            fill="#0d243c"
          />
          {/* Mortarboard Diamond Top */}
          <polygon
            points="100,16 156,32 100,48 44,32"
            fill="url(#capGrad)"
            stroke="#f4b942"
            strokeWidth="1.8"
          />
          {/* Cap Center Button */}
          <circle cx="100" cy="32" r="3.5" fill="#f4b942" />
          {/* Golden Tassel String */}
          <path
            d="M 100 32 Q 134 35 142 52"
            fill="none"
            stroke="#f4b942"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Tassel Fringe */}
          <polygon points="140,52 144,52 146,62 138,62" fill="#f4b942" />
        </g>

        {/* 4. Bear Face Details */}
        {/* Blush Cheeks */}
        <circle cx="68" cy="104" r="7" fill="#f43f5e" opacity="0.22" />
        <circle cx="132" cy="104" r="7" fill="#f43f5e" opacity="0.22" />

        {/* Muzzle / Snout */}
        <ellipse
          cx="100"
          cy="110"
          rx="22"
          ry="15"
          fill="#fef4e2"
          stroke="#5c3519"
          strokeWidth="1.5"
        />

        {/* Cute Dark Nose */}
        <ellipse cx="100" cy="103" rx="7" ry="5" fill="#2b1a10" />
        {/* Nose Highlight */}
        <ellipse cx="98.5" cy="101.5" rx="2" ry="1.2" fill="#ffffff" opacity="0.6" />

        {/* Mouth */}
        <path
          d="M 100 108 L 100 114 M 94 114 Q 100 120 106 114"
          fill="none"
          stroke="#2b1a10"
          strokeWidth="1.8"
          strokeLinecap="round"
        />

        {/* 5. Eyes & Animated Pupils */}
        {/* Left Eye */}
        <g>
          <ellipse
            cx="81"
            cy="84"
            rx="9"
            ry="11"
            fill="#ffffff"
            stroke="#5c3519"
            strokeWidth="2"
          />
          {/* Left Eyebrow */}
          <path
            d="M 73 70 Q 81 67 89 71"
            fill="none"
            stroke="#5c3519"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          {/* Left Pupil (Hidden behind paw when password focused) */}
          <g
            style={{
              transition: "transform 0.18s cubic-bezier(0.2, 0, 0.2, 1)",
              transform: `translate(${pupilOffsetX}px, ${pupilOffsetY}px)`,
            }}
          >
            <circle cx="81" cy="85" r="4.8" fill="#1b2a38" />
            <circle cx="79.5" cy="83.5" r="1.6" fill="#ffffff" />
          </g>
        </g>

        {/* Right Eye */}
        <g>
          <ellipse
            cx="119"
            cy="84"
            rx="9"
            ry="11"
            fill="#ffffff"
            stroke="#5c3519"
            strokeWidth="2"
          />
          {/* Right Eyebrow - Raises playfully when peeking */}
          <path
            d={
              isPasswordActive && showPassword
                ? "M 111 67 Q 119 62 127 67" // Raised high for curious peek!
                : "M 111 71 Q 119 67 127 70"
            }
            fill="none"
            stroke="#5c3519"
            strokeWidth="2.2"
            strokeLinecap="round"
            className="transition-all duration-200"
          />
          {/* Right Pupil */}
          <g
            style={{
              transition: "transform 0.18s cubic-bezier(0.2, 0, 0.2, 1)",
              transform: `translate(${pupilOffsetX}px, ${pupilOffsetY}px)`,
            }}
          >
            <circle cx="119" cy="85" r="4.8" fill="#1b2a38" />
            <circle cx="117.5" cy="83.5" r="1.6" fill="#ffffff" />
          </g>
        </g>

        {/* 6. Pradeep Classes Academic Collar & Striped Tie */}
        <g>
          {/* Shirt Collar */}
          <polygon points="86,138 100,146 114,138 100,132" fill="#ffffff" stroke="#c5d3e0" strokeWidth="1" />
          {/* Navy & Gold Institute Tie */}
          <path
            d="M 97 142 L 103 142 L 105 162 L 100 168 L 95 162 Z"
            fill="#102f50"
            stroke="#f4b942"
            strokeWidth="1.2"
          />
          {/* Tie Gold Accent Stripes */}
          <line x1="96" y1="148" x2="104" y2="148" stroke="#f4b942" strokeWidth="1.4" />
          <line x1="96" y1="156" x2="104" y2="156" stroke="#f4b942" strokeWidth="1.4" />
        </g>

        {/* 7. Animated Paws (Hands) with Smooth CSS Transition */}
        {/* Left Paw */}
        <g
          filter="url(#pawShadow)"
          style={{
            transformOrigin: "78px 145px",
            transform: leftPawTransform,
            transition: "transform 0.32s cubic-bezier(0.34, 1.35, 0.64, 1)",
          }}
        >
          {/* Furry Arm & Paw */}
          <path
            d="M 64 162 C 60 148, 64 135, 78 135 C 92 135, 96 148, 92 162 Z"
            fill="url(#bearCoat)"
            stroke="#5c3519"
            strokeWidth="2.2"
          />
          {/* Golden Paw Palm Pad */}
          <ellipse cx="78" cy="145" rx="7" ry="5.5" fill="#f4b942" opacity="0.95" />
          {/* 3 Cute Toe Pads */}
          <circle cx="71" cy="138" r="2.2" fill="#f4b942" />
          <circle cx="78" cy="136" r="2.2" fill="#f4b942" />
          <circle cx="85" cy="138" r="2.2" fill="#f4b942" />
        </g>

        {/* Right Paw */}
        <g
          filter="url(#pawShadow)"
          style={{
            transformOrigin: "122px 145px",
            transform: rightPawTransform,
            transition: "transform 0.32s cubic-bezier(0.34, 1.35, 0.64, 1)",
          }}
        >
          {/* Furry Arm & Paw */}
          <path
            d="M 108 162 C 104 148, 108 135, 122 135 C 136 135, 140 148, 136 162 Z"
            fill="url(#bearCoat)"
            stroke="#5c3519"
            strokeWidth="2.2"
          />
          {/* Golden Paw Palm Pad */}
          <ellipse cx="122" cy="145" rx="7" ry="5.5" fill="#f4b942" opacity="0.95" />
          {/* 3 Cute Toe Pads */}
          <circle cx="115" cy="138" r="2.2" fill="#f4b942" />
          <circle cx="122" cy="136" r="2.2" fill="#f4b942" />
          <circle cx="129" cy="138" r="2.2" fill="#f4b942" />
        </g>
      </svg>
    </div>
  );
};
