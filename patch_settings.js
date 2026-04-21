const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/settings/page.js', 'utf8');

// Fix Duplicate button
code = code.replace(`          </button>\n          </button>\n        ))}\n        </div>`, `          </button>\n        ))}\n        </div>`);
code = code.replace(`          </button>\r\n          </button>\r\n        ))}\r\n        </div>`, `          </button>\r\n        ))}\r\n        </div>`);

// Inject Hooks
const hookTarget = `  const [logoError, setLogoError] = useState('');\n\n  const { choose, alert, confirm, prompt, DialogRenderer } = useDialog();\n\n  // Profile state`;
const hookTargetDos = hookTarget.replace(/\n/g, '\r\n');

const hookReplace = `  const [logoError, setLogoError] = useState('');\n\n  const { choose, alert, confirm, prompt, DialogRenderer } = useDialog();\n\n  // Mobile Tabs scroll indicator state\n  const tabsWrapperRef = useRef(null);\n  const [canScrollRight, setCanScrollRight] = useState(false);\n\n  useEffect(() => {\n    const handleScrollOrResize = () => {\n      if (tabsWrapperRef.current) {\n        const { scrollLeft, scrollWidth, clientWidth } = tabsWrapperRef.current;\n        setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);\n      }\n    };\n    handleScrollOrResize();\n    const el = tabsWrapperRef.current;\n    if (el) el.addEventListener('scroll', handleScrollOrResize);\n    window.addEventListener('resize', handleScrollOrResize);\n    return () => {\n      if (el) el.removeEventListener('scroll', handleScrollOrResize);\n      window.removeEventListener('resize', handleScrollOrResize);\n    };\n  }, [activeTab]);\n\n  // Profile state`;

if (code.includes(hookTarget)) {
    code = code.replace(hookTarget, hookReplace);
} else if (code.includes(hookTargetDos)) {
    code = code.replace(hookTargetDos, hookReplace.replace(/\n/g, '\r\n'));
} else {
    console.log("Hook target not found");
}

fs.writeFileSync('src/app/dashboard/settings/page.js', code, 'utf8');
console.log("Patched successfully");
