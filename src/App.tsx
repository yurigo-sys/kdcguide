import { useState, useEffect, useRef, useMemo } from 'react';
import { Routes, Route, Link, useNavigate, useParams, useLocation, Navigate } from 'react-router-dom';
import { 
  BookOpen, 
  ChevronRight, 
  CreditCard, 
  LogIn, 
  LogOut,
  CheckCircle, 
  Settings, 
  Plus, 
  Trash2, 
  Edit, 
  ArrowLeft,
  Share2,
  Menu,
  X,
  Flag,
  Rocket,
  Target,
  Award,
  HelpCircle,
  MessageCircle,
  Video,
  FileText,
  Calendar,
  User,
  Lock,
  Image as ImageIcon,
  Link as LinkIcon,
  Bold,
  Upload,
  Hand,
  Search,
  CheckCircle2,
  ArrowRight,
  Save,
  Share,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Copy,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import TurndownService from 'turndown';
import { marked } from 'marked';

// --- Utilities ---
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

// Configure marked for simple HTML output
marked.setOptions({
  breaks: true,
  gfm: true
});

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const stripMarkdown = (text: string) => {
  if (!text) return '';
  return text
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links but keep text
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1')     // Remove italic
    .replace(/#{1,6}\s+(.*)/g, '$1') // Remove headers
    .replace(/`{1,3}.*?`{1,3}/gs, '') // Remove code blocks
    .replace(/>\s+(.*)/g, '$1')      // Remove blockquotes
    .replace(/\n/g, ' ')             // Replace newlines with spaces
    .replace(/\s+/g, ' ')            // Collapse multiple spaces
    .trim();
};

const ICON_MAP: Record<string, any> = {
  BookOpen,
  CreditCard,
  LogIn,
  CheckCircle,
  Settings,
  Flag,
  Rocket,
  Target,
  Award,
  HelpCircle,
  MessageCircle,
  Video,
  FileText,
  Calendar,
  User,
};

// --- Types ---
interface Post {
  id: number;
  title: string;
  content: string;
  category: string;
  icon: string;
  updated_at: string;
}

interface TrainingStep {
  id?: number;
  title: string;
  description: string;
  step_order: number;
}

interface Category {
  id: number;
  name: string;
  display_order: number;
}

interface FAQ {
  id: number;
  question: string;
  answer: string;
  updated_at: string;
}

interface ContactLink {
  label: string;
  url: string;
  icon: string;
}

interface SiteSettings {
  siteName: string;
  primaryColor: string;
  adminPassword?: string;
  logoUrl?: string;
  contactInfo?: string;
  contactLinks?: ContactLink[];
}

// --- Components ---

const RichTextEditor = ({ 
  value, 
  onChange, 
  placeholder,
  className,
  onImageUpload
}: { 
  value: string, 
  onChange: (val: string) => void, 
  placeholder?: string,
  className?: string,
  onImageUpload?: () => void
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [linkPopover, setLinkPopover] = useState<{ x: number, y: number, href: string, element: HTMLAnchorElement } | null>(null);
  const [isEditingLink, setIsEditingLink] = useState(false);
  const [tempLinkUrl, setTempLinkUrl] = useState('');
  const popoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize content and handle external updates
  useEffect(() => {
    if (editorRef.current) {
      const currentHtml = editorRef.current.innerHTML;
      const currentMarkdown = turndownService.turndown(currentHtml);
      
      if (value !== currentMarkdown) {
        const html = marked.parse(value || '');
        editorRef.current.innerHTML = typeof html === 'string' ? html : '';
      }
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      const markdown = turndownService.turndown(html);
      onChange(markdown);
    }
  };

  const execCommand = (command: string, val: string | undefined = undefined) => {
    editorRef.current?.focus();
    document.execCommand(command, false, val);
    handleInput();
  };

  const handleAddLink = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    let rect = range.getBoundingClientRect();
    
    // 텍스트 선택이 없는 경우(커서만 있는 경우) 부모 요소의 위치를 참조
    if (rect.width === 0 && rect.height === 0) {
      const parent = range.startContainer.parentElement;
      if (parent) rect = parent.getBoundingClientRect();
    }

    // 에디터 밖으로 나가는 것 방지
    const editorRect = editorRef.current?.getBoundingClientRect();
    if (!editorRect) return;

    setLinkPopover({
      x: rect.left,
      y: rect.bottom, // fixed 포지션이므로 window.scrollY를 더하지 않음
      href: '',
      element: null as any
    });
    setIsEditingLink(true);
    setTempLinkUrl('');
  };

  const saveLink = () => {
    if (!tempLinkUrl) {
      setIsEditingLink(false);
      setLinkPopover(null);
      return;
    }

    // URL 프로토콜 자동 추가 (http가 없는 경우)
    let url = tempLinkUrl;
    if (!/^https?:\/\//i.test(url) && !url.startsWith('/') && !url.startsWith('#')) {
      url = 'https://' + url;
    }

    if (linkPopover?.element) {
      linkPopover.element.setAttribute('href', url);
    } else {
      const selection = window.getSelection();
      const selectedText = selection?.toString() || '링크';
      const linkHtml = `<a href="${url}" target="_blank" class="text-brand font-bold underline">${selectedText}</a>`;
      document.execCommand('insertHTML', false, linkHtml);
    }
    
    handleInput();
    setIsEditingLink(false);
    setLinkPopover(null);
  };

  const handleMouseOver = (e: React.MouseEvent) => {
    if (isEditingLink) return;
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor) {
      if (popoverTimeoutRef.current) clearTimeout(popoverTimeoutRef.current);
      const rect = anchor.getBoundingClientRect();
      setLinkPopover({
        x: rect.left,
        y: rect.bottom, // fixed 포지션이므로 window.scrollY를 더하지 않음
        href: anchor.getAttribute('href') || '',
        element: anchor as HTMLAnchorElement
      });
    }
  };

  const handleMouseLeave = () => {
    if (isEditingLink) return;
    popoverTimeoutRef.current = setTimeout(() => {
      setLinkPopover(null);
    }, 500); // 사용자가 마우스를 옮길 시간을 더 줌
  };

  return (
    <div className={cn("relative border border-slate-200 rounded-2xl overflow-hidden bg-white transition-all", isFocused && "border-brand ring-4 ring-brand/5", className)}>
      <div className="flex items-center gap-1 p-2 border-b border-slate-100 bg-slate-50/50">
        <button 
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => execCommand('bold')}
          className="p-2 hover:bg-white hover:text-brand rounded-lg transition-all text-slate-500"
          title="굵게"
        >
          <Bold size={18} />
        </button>
        <button 
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleAddLink}
          className="p-2 hover:bg-white hover:text-brand rounded-lg transition-all text-slate-500"
          title="링크 삽입"
        >
          <LinkIcon size={18} />
        </button>
        {onImageUpload && (
          <button 
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onImageUpload}
            className="p-2 hover:bg-white hover:text-brand rounded-lg transition-all text-slate-500"
            title="이미지 삽입"
          >
            <ImageIcon size={18} />
          </button>
        )}
      </div>
      
      <div 
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onMouseOver={handleMouseOver}
        onMouseLeave={handleMouseLeave}
        className="p-6 min-h-[250px] outline-none editor-content"
        spellCheck={false}
      />

      {linkPopover && (
        <div 
          className="fixed z-[100] bg-slate-900 text-white p-1.5 rounded-xl shadow-2xl border border-white/10 flex items-center gap-2"
          style={{ left: linkPopover.x, top: linkPopover.y + 8 }}
          onMouseEnter={() => {
            if (popoverTimeoutRef.current) clearTimeout(popoverTimeoutRef.current);
          }}
          onMouseLeave={handleMouseLeave}
        >
          {isEditingLink ? (
            <div className="flex items-center gap-1 px-1">
              <input 
                autoFocus
                type="text"
                value={tempLinkUrl}
                onChange={(e) => setTempLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveLink();
                  if (e.key === 'Escape') {
                    setIsEditingLink(false);
                    setLinkPopover(null);
                  }
                }}
                placeholder="링크 주소 입력..."
                className="bg-transparent border-none outline-none text-xs w-40 placeholder:text-white/30"
              />
              <button 
                onClick={saveLink}
                className="p-1 hover:bg-white/20 rounded-md text-emerald-400"
              >
                <Check size={14} />
              </button>
              <button 
                onClick={() => {
                  setIsEditingLink(false);
                  setLinkPopover(null);
                }}
                className="p-1 hover:bg-white/20 rounded-md text-white/50"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 px-1">
              <a 
                href={linkPopover.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 hover:bg-white/20 rounded-lg transition-colors font-bold text-[11px] text-emerald-400"
              >
                <ExternalLink size={12} />
                방문
              </a>
              <div className="w-px h-3 bg-white/10 mx-1" />
              <button 
                type="button"
                onClick={() => {
                  setIsEditingLink(true);
                  setTempLinkUrl(linkPopover.href);
                }}
                className="px-2 py-1 hover:bg-white/20 rounded-lg transition-colors font-bold text-[11px]"
              >
                수정
              </button>
              <button 
                type="button"
                onClick={() => {
                  const parent = linkPopover.element.parentNode;
                  while (linkPopover.element.firstChild) {
                    parent?.insertBefore(linkPopover.element.firstChild, linkPopover.element);
                  }
                  parent?.removeChild(linkPopover.element);
                  handleInput();
                  setLinkPopover(null);
                }}
                className="px-2 py-1 hover:bg-red-500/40 text-red-300 rounded-lg transition-colors font-bold text-[11px]"
              >
                제거
              </button>
            </div>
          )}
          {/* Speech bubble tail */}
          <div className="absolute -top-1 left-4 w-2 h-2 bg-slate-900 rotate-45 border-l border-t border-white/10" />
        </div>
      )}
    </div>
  );
};

const Header = ({ settings, scrollContainerRef }: { settings: SiteSettings, scrollContainerRef?: React.RefObject<HTMLDivElement> }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const scrollToSection = (id: string) => {
    if (location.pathname !== '/') {
      navigate('/#' + id);
      return;
    }
    const element = document.getElementById(id);
    
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link to="/" className="flex items-center gap-3">
            <img 
              key={settings.logoUrl}
              src={settings.logoUrl || "https://ais-dev-ysg7qkjpfxol2zs3cfwsoo-76360252009.asia-northeast1.run.app/logo.png"} 
              alt="Logo" 
              className="w-10 h-10 rounded-lg object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://picsum.photos/seed/comento/100/100";
              }}
            />
            <span className="text-[19px] md:text-xl font-bold tracking-tight text-slate-900">
              {settings.siteName}
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <button onClick={() => scrollToSection('checklist')} className="text-slate-600 hover:text-brand font-medium transition-colors">훈련 체크리스트</button>
            <button onClick={() => scrollToSection('guides')} className="text-slate-600 hover:text-brand font-medium transition-colors">가이드 목록</button>
            <button onClick={() => scrollToSection('support')} className="text-slate-600 hover:text-brand font-medium transition-colors">문의하기</button>
            <Link to="/admin" className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50 text-slate-600 hover:bg-brand hover:text-white transition-all font-medium">
              <Lock size={16} />
              관리자
            </Link>
          </nav>

          <button 
            className="md:hidden p-2 text-slate-600"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden bg-white border-b border-slate-100 px-4 py-6 space-y-4"
          >
            <button onClick={() => scrollToSection('checklist')} className="block w-full text-left text-lg font-medium text-slate-900">훈련 체크리스트</button>
            <button onClick={() => scrollToSection('guides')} className="block w-full text-left text-lg font-medium text-slate-900">가이드 목록</button>
            <button onClick={() => scrollToSection('support')} className="block w-full text-left text-lg font-medium text-slate-900">문의하기</button>
            <Link to="/admin" onClick={() => setIsMenuOpen(false)} className="block text-lg font-medium text-brand">관리자 설정</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

const GuideCard = ({ post }: { post: Post }) => {
  const Icon = ICON_MAP[post.icon] || BookOpen;
  
  return (
    <motion.div 
      whileHover={{ y: -4 }}
      className="group bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:border-brand/20 transition-all cursor-pointer"
    >
      <Link to={`/guide/${post.id}`}>
        <div className="flex items-start justify-between mb-6">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-brand/10 group-hover:text-brand transition-colors">
            <Icon size={32} />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400 bg-slate-50 px-3 py-1 rounded-full group-hover:bg-brand/5 group-hover:text-brand/70 transition-colors">
            {post.category}
          </span>
        </div>
        <h3 className="text-2xl font-bold text-slate-900 mb-3 group-hover:text-brand transition-colors leading-tight">
          {post.title}
        </h3>
        <p className="text-slate-500 line-clamp-2 text-lg mb-6 leading-relaxed">
          {stripMarkdown(post.content).substring(0, 100)}...
        </p>
        <div className="flex items-center text-brand font-bold text-lg">
          자세히 보기
          <ChevronRight size={20} className="ml-1 group-hover:translate-x-1 transition-transform" />
        </div>
      </Link>
    </motion.div>
  );
};

const ScrollGuide = () => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsVisible(false);
      }
    };

    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 5000);

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timer);
    };
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-12 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 pointer-events-none"
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="w-12 h-12 bg-brand text-white rounded-full flex items-center justify-center shadow-lg shadow-brand/20"
          >
            <Hand size={24} />
          </motion.div>
          <span className="text-sm font-bold text-slate-900 bg-white/80 backdrop-blur-sm px-4 py-1.5 rounded-full border border-slate-100 shadow-sm">
            스크롤해서 더 많은 정보를 확인하세요
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const Home = ({ posts, trainingSteps, settings, categories, faqs, scrollContainerRef }: { posts: Post[], trainingSteps: TrainingStep[], settings: SiteSettings, categories: Category[], faqs: FAQ[], scrollContainerRef?: React.RefObject<HTMLDivElement> }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [faqSearchQuery, setFaqSearchQuery] = useState('');
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        setTimeout(() => {
          const offset = 100;
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - offset;
          window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }, 100);
      }
    }
  }, [location]);

  const filteredPosts = posts.filter(post => {
    const matchesCategory = selectedCategory === '전체' || post.category === selectedCategory;
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         post.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const filteredFaqs = faqs.filter(faq => 
    faq.question.toLowerCase().includes(faqSearchQuery.toLowerCase()) || 
    faq.answer.toLowerCase().includes(faqSearchQuery.toLowerCase())
  );

  const titleVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.6 } 
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
      <ScrollGuide />
      {/* Hero Section */}
      <section className="text-center flex flex-col justify-center min-h-[calc(100vh-80px)] py-20 md:py-32">
        <motion.h1 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={titleVariants}
          className="text-[28px] md:text-[80px] font-bold text-slate-900 mb-6 md:mb-8 tracking-tight leading-[1.2] md:leading-[1.1]"
        >
          훈련의 시작부터 수료까지,<br />
          <span className="text-brand">코멘토</span>가 함께합니다.
        </motion.h1>
        <motion.p 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={titleVariants}
          className="text-lg md:text-3xl text-slate-500 max-w-4xl mx-auto leading-relaxed px-4"
        >
          K-디지털 기초역량훈련 과정을 원활하게 진행하실 수 있도록<br className="hidden sm:block" />
          상세한 가이드를 제공해 드립니다.
        </motion.p>
      </section>

      {/* Training Process Section */}
      <section id="checklist" className="flex flex-col justify-center py-20 md:py-32 scroll-mt-24">
        <div className="text-center mb-12 md:mb-16">
          <motion.h2 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={titleVariants}
            className="text-3xl md:text-4xl font-bold text-slate-900 mb-4"
          >
            훈련 체크리스트
          </motion.h2>
          <motion.p 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={titleVariants}
            className="text-lg md:text-2xl text-slate-500 mb-8"
          >
            두근두근 훈련 시작 전 점검해볼까요?
          </motion.p>
          <div className="w-16 md:w-20 h-1.5 bg-brand mx-auto rounded-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {trainingSteps.map((step, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative bg-slate-50 rounded-[24px] md:rounded-[32px] p-6 md:p-8 border border-slate-100"
            >
              <div className="absolute -top-5 left-6 md:-top-6 md:left-8 w-10 h-10 md:w-12 md:h-12 bg-brand text-white rounded-xl md:rounded-2xl flex items-center justify-center font-bold text-lg md:text-xl shadow-lg shadow-brand/20">
                {index + 1}
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-slate-900 mt-4 mb-3 md:mb-4">{step.title}</h3>
              <div className="text-slate-500 text-base md:text-lg leading-relaxed markdown-body training-step-markdown">
                <Markdown
                  components={{
                    img: ({node, ...props}) => <img {...props} key={props.src} className="rounded-2xl shadow-sm border border-slate-100 max-w-full h-auto" />
                  }}
                >
                  {step.description}
                </Markdown>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Guides Section */}
      <section id="guides" className="flex flex-col justify-center py-20 md:py-32 scroll-mt-24">
        <div className="text-center mb-8 md:mb-10">
          <motion.h2 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={titleVariants}
            className="text-3xl md:text-4xl font-bold text-slate-900 mb-4"
          >
            상세 가이드 목록
          </motion.h2>
          <motion.p 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={titleVariants}
            className="text-lg md:text-2xl text-slate-500 mb-6"
          >
            필요한 정보를 클릭하여 확인하세요.
          </motion.p>
          
          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-2 md:gap-3 mb-8">
            <button 
              onClick={() => setSelectedCategory('전체')}
              className={cn(
                "px-4 md:px-6 py-2 md:py-2.5 rounded-full font-bold text-sm md:text-base transition-all",
                selectedCategory === '전체' ? "bg-brand text-white shadow-lg shadow-brand/20" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              )}
            >
              전체
            </button>
            {categories.map(cat => (
              <button 
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={cn(
                  "px-4 md:px-6 py-2 md:py-2.5 rounded-full font-bold text-sm md:text-base transition-all",
                  selectedCategory === cat.name ? "bg-brand text-white shadow-lg shadow-brand/20" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="max-w-md mx-auto mb-10 md:mb-12 relative px-4">
            <div className="absolute inset-y-0 left-8 md:left-5 flex items-center pointer-events-none text-slate-400">
              <Search size={18} />
            </div>
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="가이드 제목이나 내용을 검색해보세요"
              className="w-full pl-12 md:pl-14 pr-6 py-3 md:py-4 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl outline-none focus:border-brand focus:ring-4 focus:ring-brand/5 transition-all text-base md:text-lg"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {filteredPosts.map((post) => (
            <GuideCard key={post.id} post={post} />
          ))}
        </div>
      </section>

      {/* FAQ & Contact Row */}
      <section id="support" className="flex flex-col justify-center py-20 md:py-32 scroll-mt-24">
        <div className="text-center mb-6 md:mb-8">
          <motion.h2 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={titleVariants}
            className="text-3xl md:text-4xl font-bold text-slate-900 mb-4"
          >
            문의하기
          </motion.h2>
          <div className="w-16 md:w-20 h-1.5 bg-brand mx-auto rounded-full mb-6" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          {/* FAQ Section */}
          <section className="bg-white rounded-[32px] md:rounded-[48px] p-6 md:p-12 border border-slate-100 shadow-sm flex flex-col max-h-[600px] md:max-h-[800px]">
            <div className="mb-6 md:mb-8">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3 md:mb-4">자주 묻는 질문</h2>
              <p className="text-slate-500 text-base md:text-lg mb-6">궁금한 점을 빠르게 해결해 보세요.</p>
              
              {/* FAQ Search */}
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                  <Search size={18} />
                </div>
                <input 
                  type="text"
                  value={faqSearchQuery}
                  onChange={(e) => setFaqSearchQuery(e.target.value)}
                  placeholder="질문 내용을 검색해보세요"
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-brand transition-all text-sm md:text-base"
                />
              </div>
            </div>
            <div className="space-y-3 md:space-y-4 overflow-y-auto pr-2 custom-scrollbar">
              {filteredFaqs.length > 0 ? (
                filteredFaqs.map((faq) => (
                  <Link 
                    key={faq.id} 
                    to={`/faq/${faq.id}`}
                    className="block bg-slate-50 rounded-xl md:rounded-2xl p-4 md:p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-brand/20 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-8 h-8 md:w-10 md:h-10 shrink-0 bg-white rounded-lg md:rounded-xl flex items-center justify-center text-brand font-bold group-hover:bg-brand group-hover:text-white transition-colors border border-slate-100 text-sm md:text-base">
                          Q
                        </div>
                        <h3 className="text-base md:text-lg font-bold text-slate-900 group-hover:text-brand transition-colors line-clamp-1">
                          {faq.question}
                        </h3>
                      </div>
                      <ChevronRight size={18} className="text-slate-300 group-hover:text-brand group-hover:translate-x-1 transition-all shrink-0" />
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-12 text-slate-400 font-medium">
                  검색 결과가 없습니다.
                </div>
              )}
            </div>
          </section>

          {/* Contact Section */}
          {settings.contactInfo && (
            <section className="bg-brand rounded-[32px] md:rounded-[48px] p-8 md:p-12 text-center overflow-hidden relative shadow-2xl shadow-brand/30 flex flex-col justify-center">
              <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] md:w-[800px] h-[600px] md:h-[800px] bg-white rounded-full blur-[100px] md:blur-[120px]" />
              </div>
              <div className="relative z-10">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-white/20 text-white rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-6 md:mb-8">
                  <HelpCircle className="w-7 h-7 md:w-8 md:h-8" />
                </div>
                <h2 className="text-2xl md:text-4xl font-bold text-white mb-4 md:mb-6">도움이 필요하신가요?</h2>
                <p className="text-white/90 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-8 md:mb-10">
                  {settings.contactInfo}
                </p>
                <div className="flex flex-wrap justify-center gap-3 md:gap-4">
                  {settings.contactLinks?.map((link, idx) => {
                    const Icon = ICON_MAP[link.icon] || MessageCircle;
                    return (
                      <a 
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 md:px-8 py-3 md:py-4 bg-white text-brand rounded-xl md:rounded-2xl font-bold text-base md:text-lg hover:scale-105 transition-all shadow-xl flex items-center gap-2"
                      >
                        <Icon className="w-[18px] h-[18px] md:w-5 md:h-5 text-brand" />
                        {link.label}
                      </a>
                    );
                  })}
                </div>
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  );
};

const GuideDetail = () => {
  const { id } = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`/api/posts/${id}`)
      .then(res => res.json())
      .then(data => setPost(data));
  }, [id]);

  if (!post) return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-20">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center text-slate-500 hover:text-brand mb-8 transition-colors text-lg font-medium"
      >
        <ArrowLeft size={20} className="mr-2" />
        뒤로 가기
      </button>

      <article className="bg-white rounded-[40px] p-6 md:p-16 border border-slate-100 shadow-sm">
        <header className="mb-8 md:mb-12 border-b border-slate-100 pb-8 md:pb-12">
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <span className="px-3 md:px-4 py-1 md:py-1.5 bg-brand/10 text-brand rounded-full text-xs md:text-sm font-bold uppercase tracking-wider">
              {post.category}
            </span>
            <span className="text-slate-400 text-xs md:text-sm">
              최종 업데이트: {new Date(post.updated_at).toLocaleDateString()}
            </span>
          </div>
          <h1 className="text-2xl md:text-5xl font-bold text-slate-900 leading-tight">
            {post.title}
          </h1>
        </header>

        <div className="markdown-body">
          <Markdown>{post.content}</Markdown>
        </div>

        <div className="mt-16 pt-12 border-t border-slate-100 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert('링크가 복사되었습니다.');
              }}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all"
            >
              <Share2 size={20} />
              링크복사
            </button>
          </div>
          <p className="text-slate-400 text-sm">© K-디지털 기초역량훈련 학습 가이드</p>
        </div>
      </article>
    </div>
  );
};

const FAQDetail = () => {
  const { id } = useParams();
  const [faq, setFaq] = useState<FAQ | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`/api/faqs/${id}`)
      .then(res => res.json())
      .then(data => setFaq(data));
  }, [id]);

  if (!faq) return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 md:py-20">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center text-slate-500 hover:text-brand mb-8 transition-colors text-lg font-medium"
      >
        <ArrowLeft size={20} className="mr-2" />
        뒤로 가기
      </button>

      <article className="bg-white rounded-[40px] p-6 md:p-16 border border-slate-100 shadow-sm">
        <header className="mb-8 md:mb-12 border-b border-slate-100 pb-8 md:pb-12">
          <div className="flex items-center gap-4 mb-4 md:mb-6">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-brand text-white rounded-xl md:rounded-2xl flex items-center justify-center text-xl md:text-2xl font-bold shrink-0">
              Q
            </div>
            <span className="text-slate-400 text-xs md:text-sm">
              최종 업데이트: {new Date(faq.updated_at).toLocaleDateString()}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">
            {faq.question}
          </h1>
        </header>

        <div className="markdown-body faq-answer-markdown">
          <Markdown>{faq.answer}</Markdown>
        </div>

        <div className="mt-16 pt-12 border-t border-slate-100">
          <p className="text-slate-400 text-sm text-center">© K-디지털 기초역량훈련 자주 묻는 질문</p>
        </div>
      </article>
    </div>
  );
};

const AdminDashboard = ({ posts, settings, trainingSteps, categories, faqs, onRefresh }: { posts: Post[], settings: SiteSettings, trainingSteps: TrainingStep[], categories: Category[], faqs: FAQ[], onRefresh: () => void }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingLogin, setIsCheckingLogin] = useState(true);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [isEditingSteps, setIsEditingSteps] = useState(false);
  const [isEditingContactLinks, setIsEditingContactLinks] = useState(false);
  const [tempSettings, setTempSettings] = useState(settings);
  const [editingPost, setEditingPost] = useState<Partial<Post> | null>(null);
  const [tempSteps, setTempSteps] = useState<TrainingStep[]>(trainingSteps);
  const [editingCategories, setEditingCategories] = useState<Category[]>(categories);
  const [editingFaq, setEditingFaq] = useState<Partial<FAQ> | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmDeleteFaqId, setConfirmDeleteFaqId] = useState<number | null>(null);
  const [dbStatus, setDbStatus] = useState<{ usePostgres: boolean, isVercel: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/db-status').then(res => res.json()).then(setDbStatus).catch(console.error);
  }, []);

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const res = await fetch('/api/admin/check');
        if (res.ok) {
          setIsLoggedIn(true);
        }
      } catch (error) {
        console.error('Login check failed:', error);
      } finally {
        setIsCheckingLogin(false);
      }
    };
    checkLogin();
  }, []);

  useEffect(() => {
    setEditingCategories(categories);
  }, [categories]);

  useEffect(() => {
    setTempSteps(trainingSteps);
  }, [trainingSteps]);

  useEffect(() => {
    setTempSettings(settings);
  }, [settings]);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        return data.url;
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('업로드에 실패했습니다.');
    } finally {
      setIsUploading(false);
    }
    return null;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.trim() })
    });
    if (res.ok) {
      setIsLoggedIn(true);
      setLoginError('');
    } else {
      setLoginError('비밀번호가 올바르지 않습니다.');
    }
  };

  const handleSaveSettings = async () => {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tempSettings)
    });
    setIsEditingSettings(false);
    onRefresh();
  };

  const handleSaveSteps = async () => {
    await fetch('/api/training-process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps: tempSteps })
    });
    alert('훈련 과정이 저장되었습니다.');
    setIsEditingSteps(false);
    onRefresh();
  };

  const handleDeletePost = async (id: number) => {
    console.log('handleDeletePost executing for ID:', id);
    try {
      const res = await fetch('/api/posts/delete', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(id) })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.changes > 0) {
          onRefresh();
        } else {
          alert('삭제할 대상을 찾지 못했습니다.');
        }
      } else {
        const data = await res.json();
        alert(`삭제 실패: ${data.message || '알 수 없는 오류'}`);
      }
    } catch (error: any) {
      console.error('Delete failed:', error);
      alert('삭제 중 오류가 발생했습니다: ' + error.message);
    }
  };

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingPost?.id ? 'PUT' : 'POST';
    const url = editingPost?.id ? `/api/posts/${editingPost.id}` : '/api/posts';
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPost)
      });
      if (res.ok) {
        alert(editingPost?.id ? '수정되었습니다.' : '저장되었습니다.');
        setEditingPost(null);
        onRefresh();
      } else {
        alert('저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Save post failed:', error);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingFaq?.id ? 'PUT' : 'POST';
    const url = editingFaq?.id ? `/api/faqs/${editingFaq.id}` : '/api/faqs';
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingFaq)
      });
      if (res.ok) {
        alert(editingFaq?.id ? '수정되었습니다.' : '저장되었습니다.');
        setEditingFaq(null);
        onRefresh();
      } else {
        alert('저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Save FAQ failed:', error);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteFaq = async (id: number) => {
    console.log('handleDeleteFaq executing for ID:', id);
    try {
      const res = await fetch('/api/faqs/delete', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(id) })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.changes > 0) {
          onRefresh();
        } else {
          alert('삭제할 대상을 찾지 못했습니다.');
        }
      } else {
        const data = await res.json();
        alert(`삭제 실패: ${data.message || '알 수 없는 오류'}`);
      }
    } catch (error: any) {
      console.error('Delete FAQ failed:', error);
      alert('삭제 중 오류가 발생했습니다: ' + error.message);
    }
  };

  const handleAddCategory = () => {
    if (!newCategoryName) return;
    const newCat = { id: Date.now(), name: newCategoryName, display_order: editingCategories.length + 1 };
    setEditingCategories([...editingCategories, newCat]);
    setNewCategoryName('');
  };

  const handleDeleteCategory = (id: number) => {
    setEditingCategories(editingCategories.filter(c => c.id !== id));
  };

  const handleSaveCategories = async () => {
    try {
      const res = await fetch('/api/categories/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: editingCategories })
      });
      if (res.ok) {
        alert('카테고리가 저장되었습니다.');
        onRefresh();
      } else {
        alert('저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Save failed:', error);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setIsLoggedIn(false);
  };

  if (isCheckingLogin) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-20">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 md:p-12 rounded-[40px] border border-slate-100 shadow-xl w-full max-w-md"
        >
          <div className="w-16 h-16 bg-brand/10 text-brand rounded-2xl flex items-center justify-center mx-auto mb-8">
            <Lock size={32} />
          </div>
          <h1 className="text-3xl font-bold text-center text-slate-900 mb-8">관리자 로그인</h1>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">비밀번호</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-6 py-4 rounded-2xl border border-slate-200 focus:border-brand outline-none transition-all text-lg"
                placeholder="관리자 비밀번호 입력"
              />
            </div>
            {loginError && <p className="text-red-500 font-medium text-center">{loginError}</p>}
            <button className="w-full py-5 bg-brand text-white rounded-2xl font-bold text-xl shadow-lg shadow-brand/20 hover:scale-[1.02] transition-all">
              접속하기
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <AnimatePresence>
        {isUploading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-white/60 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-100 flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-lg font-bold text-slate-900">파일 업로드 중...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">관리자 대시보드</h1>
          <p className="text-slate-500 text-lg">가이드 콘텐츠와 사이트 설정을 관리하세요.</p>
        </div>
        <div className="flex items-center gap-3">
          {dbStatus && (
            <div className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border",
              dbStatus.usePostgres ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
            )}>
              <div className={cn("w-2 h-2 rounded-full", dbStatus.usePostgres ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
              {dbStatus.usePostgres ? "DB: Postgres (Persistent)" : "DB: SQLite (Ephemeral - Data will be lost on Vercel)"}
            </div>
          )}
          <button 
            onClick={() => setShowExportModal(true)}
            className="px-6 py-2 bg-brand/10 text-brand rounded-xl font-bold hover:bg-brand/20 transition-all flex items-center gap-2"
          >
            <Share2 size={18} />
            데이터 백업
          </button>
          <button 
            onClick={handleLogout}
            className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
          >
            <LogOut size={18} />
            로그아웃
          </button>
        </div>
      </div>

      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExportModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl p-8 md:p-12"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900">데이터 백업 (JSON)</h2>
                <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-900">
                  <X size={24} />
                </button>
              </div>
              <p className="text-slate-500 mb-6">
                Vercel 배포 환경에서는 데이터가 자주 초기화됩니다. 아래 내용을 복사하여 AI Studio의 <b>initial-data.json</b> 파일에 붙여넣고 다시 배포하시면 데이터가 영구적으로 보존됩니다.
              </p>
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-6">
                <pre className="text-xs font-mono overflow-auto max-h-[300px] whitespace-pre-wrap">
                  {JSON.stringify({
                    posts,
                    categories,
                    faqs,
                    training_process: trainingSteps,
                    settings: {
                      ...settings,
                      contactLinks: settings.contactLinks
                    }
                  }, null, 2)}
                </pre>
              </div>
              <button 
                onClick={() => {
                  const json = JSON.stringify({
                    posts,
                    categories,
                    faqs,
                    training_process: trainingSteps,
                    settings: {
                      ...settings,
                      contactLinks: settings.contactLinks
                    }
                  }, null, 2);
                  navigator.clipboard.writeText(json);
                  alert('클립보드에 복사되었습니다. initial-data.json 파일에 붙여넣어 주세요.');
                }}
                className="w-full py-4 bg-brand text-white rounded-2xl font-bold text-lg shadow-lg shadow-brand/20"
              >
                JSON 복사하기
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Settings Section */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-slate-900">사이트 설정</h2>
              <button 
                onClick={() => setIsEditingSettings(!isEditingSettings)}
                className="text-brand font-bold hover:underline"
              >
                {isEditingSettings ? '취소' : '수정'}
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">사이트 이름</label>
                {isEditingSettings ? (
                  <input 
                    type="text" 
                    value={tempSettings.siteName}
                    onChange={e => setTempSettings({...tempSettings, siteName: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none"
                  />
                ) : (
                  <p className="text-lg font-medium text-slate-900">{settings.siteName}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">로고 설정</label>
                {isEditingSettings ? (
                  <div className="space-y-4">
                    {tempSettings.logoUrl && (
                      <div className="relative w-20 h-20 group">
                        <img 
                          key={tempSettings.logoUrl}
                          src={tempSettings.logoUrl} 
                          alt="Logo Preview" 
                          className="w-full h-full rounded-2xl object-cover border border-slate-100 shadow-sm" 
                        />
                        <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-[10px] text-white font-bold">미리보기</span>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={tempSettings.logoUrl}
                        onChange={e => setTempSettings({...tempSettings, logoUrl: e.target.value})}
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-brand text-sm"
                        placeholder="로고 이미지 URL"
                      />
                      <label className="cursor-pointer px-4 py-3 bg-slate-100 rounded-xl text-slate-600 hover:bg-slate-200 transition-all flex items-center justify-center">
                        <Upload size={20} />
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setTempSettings({...tempSettings, logoUrl: reader.result as string});
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <img key={settings.logoUrl} src={settings.logoUrl} alt="Logo" className="w-10 h-10 rounded-xl object-cover border border-slate-100" />
                    <p className="text-sm text-slate-500 truncate max-w-[150px]">{settings.logoUrl}</p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">관리자 비밀번호</label>
                {isEditingSettings ? (
                  <input 
                    type="text" 
                    value={tempSettings.adminPassword}
                    onChange={e => setTempSettings({...tempSettings, adminPassword: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none"
                    placeholder="새 비밀번호"
                  />
                ) : (
                  <p className="text-lg font-medium text-slate-900">********</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">문의처 안내 문구</label>
                {isEditingSettings ? (
                  <textarea 
                    value={tempSettings.contactInfo}
                    onChange={e => setTempSettings({...tempSettings, contactInfo: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none min-h-[100px]"
                    placeholder="문의처 안내 문구를 입력하세요"
                  />
                ) : (
                  <p className="text-lg font-medium text-slate-900">{settings.contactInfo || '설정된 문구가 없습니다.'}</p>
                )}
              </div>
              {isEditingSettings && (
                <button 
                  onClick={handleSaveSettings}
                  className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
                >
                  설정 저장하기
                </button>
              )}
            </div>
          </div>

          {/* Contact Links Section */}
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center text-brand">
                  <ExternalLink size={20} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">문의처 링크 관리</h2>
              </div>
              <button 
                onClick={() => {
                  if (isEditingContactLinks) {
                    handleSaveSettings();
                  }
                  setIsEditingContactLinks(!isEditingContactLinks);
                }}
                className={cn(
                  "px-4 py-2 rounded-xl font-bold text-sm transition-all",
                  isEditingContactLinks 
                    ? "bg-brand text-white shadow-lg shadow-brand/20" 
                    : "text-brand hover:bg-brand/5"
                )}
              >
                {isEditingContactLinks ? '저장하기' : '수정'}
              </button>
            </div>

            <div className="space-y-3">
              {(tempSettings.contactLinks || []).map((link, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:border-slate-200">
                  {isEditingContactLinks ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">링크 {idx + 1}</span>
                        <button 
                          onClick={() => {
                            const newLinks = (tempSettings.contactLinks || []).filter((_, i) => i !== idx);
                            setTempSettings({...tempSettings, contactLinks: newLinks});
                          }}
                          className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input 
                          type="text" 
                          value={link.label}
                          onChange={e => {
                            const newLinks = [...(tempSettings.contactLinks || [])];
                            newLinks[idx].label = e.target.value;
                            setTempSettings({...tempSettings, contactLinks: newLinks});
                          }}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand bg-white"
                          placeholder="버튼 이름 (예: 카카오톡 문의)"
                        />
                        <input 
                          type="text" 
                          value={link.url}
                          onChange={e => {
                            const newLinks = [...(tempSettings.contactLinks || [])];
                            newLinks[idx].url = e.target.value;
                            setTempSettings({...tempSettings, contactLinks: newLinks});
                          }}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand bg-white"
                          placeholder="URL 주소"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 border border-slate-100">
                          <LinkIcon size={14} />
                        </div>
                        <span className="font-bold text-slate-700">{link.label}</span>
                      </div>
                      <span className="text-xs text-slate-400 truncate max-w-[150px] font-mono">{link.url}</span>
                    </div>
                  )}
                </div>
              ))}
              
              {isEditingContactLinks && (
                <button 
                  onClick={() => setTempSettings({...tempSettings, contactLinks: [...(tempSettings.contactLinks || []), { label: '', url: '', icon: 'MessageCircle' }]})}
                  className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm font-bold hover:border-brand hover:text-brand hover:bg-brand/5 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  새 링크 추가
                </button>
              )}

              {tempSettings.contactLinks?.length === 0 && !isEditingContactLinks && (
                <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-slate-400 text-sm">등록된 링크가 없습니다.</p>
                </div>
              )}
            </div>
          </div>

          {/* Training Process Editor */}
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center text-brand">
                  <CheckCircle2 size={20} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">훈련 과정 관리</h2>
              </div>
              <button 
                onClick={() => {
                  if (isEditingSteps) {
                    handleSaveSteps();
                  } else {
                    setIsEditingSteps(true);
                  }
                }}
                className={cn(
                  "px-4 py-2 rounded-xl font-bold text-sm transition-all",
                  isEditingSteps 
                    ? "bg-brand text-white shadow-lg shadow-brand/20" 
                    : "text-brand hover:bg-brand/5"
                )}
              >
                {isEditingSteps ? '저장하기' : '수정'}
              </button>
            </div>
            
            <div className="space-y-4">
              {tempSteps.map((step, idx) => (
                <div key={idx} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:border-slate-200">
                  {isEditingSteps ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-brand text-white rounded-md flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">단계 {idx + 1}</span>
                        </div>
                        <button 
                          onClick={() => setTempSteps(tempSteps.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <input 
                        type="text" 
                        value={step.title}
                        onChange={e => {
                          const newSteps = [...tempSteps];
                          newSteps[idx] = { ...newSteps[idx], title: e.target.value };
                          setTempSteps(newSteps);
                        }}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-base font-bold outline-none focus:border-brand bg-white"
                        placeholder="단계 제목 (예: 1. 서류 접수)"
                      />
                      <RichTextEditor 
                        value={step.description || ''}
                        onChange={(val) => {
                          const newSteps = [...tempSteps];
                          newSteps[idx] = { ...newSteps[idx], description: val };
                          setTempSteps(newSteps);
                        }}
                        onImageUpload={async () => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = async (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              const url = await handleFileUpload(file);
                              if (url) {
                                const newSteps = [...tempSteps];
                                const imgMarkdown = `\n![이미지](${url})\n`;
                                newSteps[idx] = { 
                                  ...newSteps[idx], 
                                  description: (newSteps[idx].description || '') + imgMarkdown 
                                };
                                setTempSteps(newSteps);
                              }
                            }
                          };
                          input.click();
                        }}
                        className="min-h-[150px]"
                      />
                    </div>
                  ) : (
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-brand font-bold border border-slate-100 shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-900 mb-1 truncate">{step.title}</h3>
                        <p className="text-sm text-slate-500 line-clamp-2">{stripMarkdown(step.description)}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isEditingSteps && (
                <button 
                  onClick={() => setTempSteps([...tempSteps, { title: '', description: '', step_order: tempSteps.length + 1 }])}
                  className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm font-bold hover:border-brand hover:text-brand hover:bg-brand/5 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  새 단계 추가
                </button>
              )}

              {tempSteps.length === 0 && !isEditingSteps && (
                <div className="py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <p className="text-slate-400 font-medium">등록된 훈련 과정이 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Posts and FAQ List Section */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h2 className="text-2xl font-bold text-slate-900">가이드 목록</h2>
              <button 
                onClick={() => setEditingPost({ title: '', content: '', category: '일반', icon: 'BookOpen' })}
                className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-xl font-bold text-sm shadow-lg shadow-brand/20 hover:scale-105 transition-all"
              >
                <Plus size={18} />
                새 가이드 작성
              </button>
            </div>
            
            {/* Category Manager Integrated */}
            <div className="p-8 bg-slate-50/50 border-b border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">카테고리 관리</h3>
                <button 
                  onClick={handleSaveCategories}
                  className="text-xs font-bold text-brand hover:underline"
                >
                  변경사항 저장
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {editingCategories.map(cat => (
                  <div key={cat.id} className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-slate-200 shadow-sm">
                    <span className="text-sm font-medium text-slate-700">{cat.name}</span>
                    <button onClick={() => handleDeleteCategory(cat.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 max-w-sm">
                <input 
                  type="text" 
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-xl border border-slate-200 outline-none text-sm bg-white"
                  placeholder="새 카테고리 이름"
                />
                <button 
                  onClick={handleAddCategory}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm"
                >
                  추가
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-50">
              {posts.map(post => (
                <div key={post.id} className="p-8 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-brand/10 group-hover:text-brand transition-colors">
                      {(() => {
                        const Icon = ICON_MAP[post.icon] || BookOpen;
                        return <Icon size={24} />;
                      })()}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 mb-1">{post.title}</h3>
                      <p className="text-slate-400 font-medium">{post.category} • {new Date(post.updated_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setEditingPost(post)}
                      className="p-3 text-slate-400 hover:text-brand hover:bg-brand/5 rounded-xl transition-all"
                    >
                      <Edit size={20} />
                    </button>
                    {confirmDeleteId === post.id ? (
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => {
                            handleDeletePost(post.id);
                            setConfirmDeleteId(null);
                          }}
                          className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors"
                        >
                          삭제확인
                        </button>
                        <button 
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-1.5 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-300 transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setConfirmDeleteId(post.id)}
                        className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ List */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-900">자주 묻는 질문 관리</h2>
              <button 
                onClick={() => setEditingFaq({ question: '', answer: '' })}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm"
              >
                <Plus size={16} />
                새 FAQ 추가
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              {faqs.map(faq => (
                <div key={faq.id} className="p-8 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-brand/10 group-hover:text-brand transition-colors shrink-0">
                      <HelpCircle size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 mb-1 line-clamp-1">{faq.question}</h3>
                      <p className="text-slate-400 font-medium">{new Date(faq.updated_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setEditingFaq(faq)}
                      className="p-3 text-slate-400 hover:text-brand hover:bg-brand/5 rounded-xl transition-all"
                    >
                      <Edit size={20} />
                    </button>
                    {confirmDeleteFaqId === faq.id ? (
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => {
                            handleDeleteFaq(faq.id);
                            setConfirmDeleteFaqId(null);
                          }}
                          className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors"
                        >
                          삭제확인
                        </button>
                        <button 
                          onClick={() => setConfirmDeleteFaqId(null)}
                          className="px-3 py-1.5 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-300 transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setConfirmDeleteFaqId(faq.id)}
                        className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Post Editor Modal */}
      <AnimatePresence>
        {editingPost && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingPost(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[40px] shadow-2xl p-8 md:p-12"
            >
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-bold text-slate-900">
                  {editingPost.id ? '가이드 수정' : '새 가이드 추가'}
                </h2>
                <button onClick={() => setEditingPost(null)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                  <X size={32} />
                </button>
              </div>

              <form onSubmit={handleSavePost} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">제목</label>
                    <input 
                      required
                      type="text" 
                      value={editingPost.title}
                      onChange={e => setEditingPost({...editingPost, title: e.target.value})}
                      placeholder="가이드 제목을 입력하세요"
                      className="w-full px-6 py-4 rounded-2xl border border-slate-200 focus:border-brand focus:ring-4 focus:ring-brand/10 outline-none transition-all text-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">카테고리</label>
                    <select 
                      required
                      value={editingPost.category}
                      onChange={e => setEditingPost({...editingPost, category: e.target.value})}
                      className="w-full px-6 py-4 rounded-2xl border border-slate-200 focus:border-brand focus:ring-4 focus:ring-brand/10 outline-none transition-all text-lg bg-white"
                    >
                      <option value="">카테고리 선택</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">아이콘 선택</label>
                  <div className="flex flex-wrap gap-3">
                    {Object.keys(ICON_MAP).map(iconName => {
                      const Icon = ICON_MAP[iconName];
                      return (
                        <button 
                          key={iconName}
                          type="button"
                          onClick={() => setEditingPost({...editingPost, icon: iconName})}
                          className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all",
                            editingPost.icon === iconName 
                              ? "border-brand bg-brand/5 text-brand" 
                              : "border-slate-100 text-slate-400 hover:border-slate-200"
                          )}
                        >
                          <Icon size={20} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">내용</label>
                  </div>
                  <RichTextEditor 
                    value={editingPost.content || ''}
                    onChange={(val) => setEditingPost({ ...editingPost, content: val })}
                    onImageUpload={async () => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          const url = await handleFileUpload(file);
                          if (url) {
                            const imgMarkdown = `\n![이미지](${url})\n`;
                            setEditingPost({ ...editingPost, content: (editingPost.content || '') + imgMarkdown });
                          }
                        }
                      };
                      input.click();
                    }}
                    className="min-h-[400px]"
                  />
                </div>

                <div className="flex gap-4 pt-6">
                  <button 
                    type="submit"
                    className="flex-1 py-5 bg-brand text-white rounded-2xl font-bold text-xl shadow-xl shadow-brand/20 hover:scale-[1.02] transition-all"
                  >
                    저장하기
                  </button>
                  <button 
                    type="button"
                    onClick={() => setEditingPost(null)}
                    className="px-10 py-5 bg-slate-100 text-slate-600 rounded-2xl font-bold text-xl hover:bg-slate-200 transition-all"
                  >
                    취소
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FAQ Editor Modal */}
      <AnimatePresence>
        {editingFaq && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingFaq(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[40px] shadow-2xl p-8 md:p-12"
            >
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-bold text-slate-900">
                  {editingFaq.id ? 'FAQ 수정' : '새 FAQ 추가'}
                </h2>
                <button onClick={() => setEditingFaq(null)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                  <X size={32} />
                </button>
              </div>

              <form onSubmit={handleSaveFaq} className="space-y-8">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">질문</label>
                  <input 
                    required
                    type="text" 
                    value={editingFaq.question}
                    onChange={e => setEditingFaq({...editingFaq, question: e.target.value})}
                    placeholder="질문을 입력하세요"
                    className="w-full px-6 py-4 rounded-2xl border border-slate-200 focus:border-brand focus:ring-4 focus:ring-brand/10 outline-none transition-all text-lg"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">답변</label>
                  <RichTextEditor 
                    value={editingFaq.answer || ''}
                    onChange={(val) => setEditingFaq({ ...editingFaq, answer: val })}
                    className="min-h-[300px]"
                  />
                </div>

                <div className="flex gap-4 pt-6">
                  <button 
                    type="submit"
                    className="flex-1 py-5 bg-brand text-white rounded-2xl font-bold text-xl shadow-xl shadow-brand/20 hover:scale-[1.02] transition-all"
                  >
                    저장하기
                  </button>
                  <button 
                    type="button"
                    onClick={() => setEditingFaq(null)}
                    className="px-10 py-5 bg-slate-100 text-slate-600 rounded-2xl font-bold text-xl hover:bg-slate-200 transition-all"
                  >
                    취소
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Footer = ({ settings }: { settings: SiteSettings }) => (
  <footer className="bg-slate-50 border-t border-slate-100 py-20">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="flex items-center gap-2 mb-6">
            <img 
              key={settings.logoUrl}
              src={settings.logoUrl || "https://ais-dev-ysg7qkjpfxol2zs3cfwsoo-76360252009.asia-northeast1.run.app/logo.png"} 
              alt="Logo" 
              className="w-8 h-8 rounded-lg object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "https://picsum.photos/seed/comento/100/100";
              }}
            />
            <span className="text-lg font-bold text-slate-900">{settings.siteName}</span>
          </div>
          <p className="text-slate-500 text-lg max-w-xl leading-relaxed">
            코멘토는 여러분의 성장을 진심으로 응원합니다.
          </p>
        </div>
        <div className="flex flex-col md:items-end gap-6">
          <p className="text-slate-400">© 2024 Comento. All rights reserved.</p>
        </div>
      </div>
    </div>
  </footer>
);

// --- Main App ---

export default function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [trainingSteps, setTrainingSteps] = useState<TrainingStep[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [settings, setSettings] = useState<SiteSettings>({
    siteName: "K-디지털 기초역량훈련 학습 가이드",
    primaryColor: '#307FE2',
    logoUrl: 'https://ais-dev-ysg7qkjpfxol2zs3cfwsoo-76360252009.asia-northeast1.run.app/logo.png',
    contactLinks: []
  });
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const fetchData = async () => {
    try {
      const t = Date.now();
      const [postsRes, settingsRes, stepsRes, categoriesRes, faqsRes] = await Promise.all([
        fetch(`/api/posts?t=${t}`),
        fetch(`/api/settings?t=${t}`),
        fetch(`/api/training-process?t=${t}`),
        fetch(`/api/categories?t=${t}`),
        fetch(`/api/faqs?t=${t}`)
      ]);
      const postsData = await postsRes.json();
      const settingsData = await settingsRes.json();
      const stepsData = await stepsRes.json();
      const categoriesData = await categoriesRes.json();
      const faqsData = await faqsRes.json();

      setPosts(postsData);
      setTrainingSteps(stepsData);
      setCategories(categoriesData);
      setFaqs(faqsData);

      if (settingsData.contactLinks) {
        settingsData.contactLinks = JSON.parse(settingsData.contactLinks);
      }
      setSettings(settingsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-2xl">로딩 중...</div>;

  const isHomePage = location.pathname === '/';

  return (
    <div className={cn(
      "min-h-screen flex flex-col bg-white"
    )}>
      <Header settings={settings} scrollContainerRef={scrollContainerRef} />
      
      <div 
        ref={scrollContainerRef}
        className={cn(
          "flex-grow scroll-smooth"
        )}
      >
        <main>
          <Routes>
            <Route path="/" element={<Home posts={posts} trainingSteps={trainingSteps} settings={settings} categories={categories} faqs={faqs} scrollContainerRef={scrollContainerRef} />} />
            <Route path="/guide/:id" element={<GuideDetail />} />
            <Route path="/faq/:id" element={<FAQDetail />} />
            <Route path="/admin" element={<AdminDashboard posts={posts} settings={settings} trainingSteps={trainingSteps} categories={categories} faqs={faqs} onRefresh={fetchData} />} />
          </Routes>
        </main>

        <Footer settings={settings} />
      </div>
    </div>
  );
}
