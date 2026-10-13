import React, { useState, useEffect } from 'react';
import { 
  Sparkles, BookOpen, BookmarkCheck, Search, Send, 
  CheckCircle2, AlertCircle, ArrowRight, Flame, Layers, ShieldCheck
} from 'lucide-react';
import { Batch, ContentItem, ResolvedMedia, CourseDetail } from './types';
import { studyApi } from './services/studyApi';
import { TELEGRAM_CHANNEL_URL } from './data/fallbackData';
import { Navbar } from './components/Navbar';
import { BatchCard } from './components/BatchCard';
import { CourseView } from './components/CourseView';
import { VideoPlayerView } from './components/VideoPlayerView';
import { TelegramModal } from './components/TelegramModal';
import { PdfReaderModal } from './components/PdfReaderModal';
import { DownloadModal } from './components/DownloadModal';
import { CourseOverviewModal } from './components/CourseOverviewModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { Footer } from './components/Footer';

export default function App() {
  // Navigation & View state
  const [currentView, setCurrentView] = useState<'home' | 'course' | 'player'>('home');
  const [selectedCourseId, setSelectedCourseId] = useState<string | number | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<ResolvedMedia | null>(null);
  const [playerPlaylist, setPlayerPlaylist] = useState<ContentItem[]>([]);

  // Data state
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(true);
  const [enrolledIds, setEnrolledIds] = useState<string[]>([]);
  
  // Filtering & Search
  const [activeTab, setActiveTab] = useState<'all' | 'jee' | 'neet' | 'enrollments'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [activePdfMedia, setActivePdfMedia] = useState<ResolvedMedia | null>(null);
  const [activeDownloadMedia, setActiveDownloadMedia] = useState<ResolvedMedia | null>(null);
  const [overviewModalData, setOverviewModalData] = useState<{ detail: CourseDetail | null; batch: Batch | null } | null>(null);

  // Toast notification
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  // 1. Initial Load: Batches, Enrollments, URL params, Telegram popup
  useEffect(() => {
    // Load enrollments
    setEnrolledIds(studyApi.getEnrollments());

    // Load batches
    setIsLoadingBatches(true);
    studyApi.getBatches().then((data) => {
      setBatches(data);
      setIsLoadingBatches(false);
    });

    // Check URL parameters for direct deep-linking
    const params = new URLSearchParams(window.location.search);
    const directCourseId = params.get('course') || params.get('id');
    const directContentId = params.get('content') || params.get('contentId');

    if (directCourseId) {
      setSelectedCourseId(directCourseId);
      if (directContentId) {
        studyApi.resolveMedia(directCourseId, directContentId).then((media) => {
          if (media) {
            if (media.file_type === 'pdf') {
              setActivePdfMedia(media);
              setCurrentView('course');
            } else {
              setSelectedMedia(media);
              setCurrentView('player');
            }
          } else {
            setCurrentView('course');
          }
        });
      } else {
        setCurrentView('course');
      }
    }

    // Show Telegram popup on initial visit (respecting session)
    const hasSeenPopup = sessionStorage.getItem('gbstudy_telegram_seen');
    if (!hasSeenPopup) {
      const timer = setTimeout(() => {
        setIsTelegramModalOpen(true);
        sessionStorage.setItem('gbstudy_telegram_seen', 'true');
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  // Sync browser history state
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const cId = params.get('course') || params.get('id');
      if (cId) {
        setSelectedCourseId(cId);
        setCurrentView('course');
        setSelectedMedia(null);
      } else {
        setCurrentView('home');
        setSelectedCourseId(null);
        setSelectedMedia(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Navigation handlers
  const handleNavigateHome = () => {
    setCurrentView('home');
    setSelectedCourseId(null);
    setSelectedMedia(null);
    window.history.pushState({}, '', window.location.pathname);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenCourse = (batchId: string | number) => {
    setSelectedCourseId(batchId);
    setCurrentView('course');
    setSelectedMedia(null);
    window.history.pushState({}, '', `?course=${batchId}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePlayVideo = (media: ResolvedMedia, playlist: ContentItem[]) => {
    setSelectedMedia(media);
    setPlayerPlaylist(playlist);
    setCurrentView('player');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectPlaylistItem = async (item: ContentItem) => {
    if (!selectedCourseId) return;
    const resolved = await studyApi.resolveMedia(selectedCourseId, item.entity_id, item);
    if (resolved) {
      if (resolved.file_type === 'pdf') {
        setActivePdfMedia(resolved);
      } else {
        setSelectedMedia(resolved);
      }
    }
  };

  const handleToggleEnroll = (e: React.MouseEvent, batchId: string | number) => {
    e.stopPropagation();
    const result = studyApi.toggleEnrollment(batchId);
    setEnrolledIds(result.list);
    showToast(result.enrolled ? "Enrolled in batch!" : "Removed from enrollments");
  };

  const handleOpenOverview = async (batch: Batch) => {
    const detail = await studyApi.getCourseOverview(batch.id);
    setOverviewModalData({ detail, batch });
  };

  // Filter batches for Homepage
  const filteredBatches = batches.filter((b) => {
    const idStr = String(b.id);
    const titleLower = b.title.toLowerCase();

    // Tab filter
    if (activeTab === 'enrollments' && !enrolledIds.includes(idStr)) {
      return false;
    }
    if (activeTab === 'jee' && !titleLower.includes('jee') && b.category !== 'JEE') {
      return false;
    }
    if (activeTab === 'neet' && !titleLower.includes('neet') && b.category !== 'NEET') {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match = titleLower.includes(q) || 
        idStr.includes(q) || 
        (b.description && b.description.toLowerCase().includes(q)) ||
        (b.tags && b.tags.some(t => t.toLowerCase().includes(q)));
      if (!match) return false;
    }

    return true;
  });

  const selectedBatchInfo = batches.find(b => String(b.id) === String(selectedCourseId));

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex flex-col font-sans selection:bg-amber-400 selection:text-black">
      
      {/* Toast System */}
      {toastMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold border shadow-2xl bg-zinc-900 border-amber-400/30 text-amber-400 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Telegram Channel Popup Modal */}
      <TelegramModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
      />

      {/* PDF Reader Modal */}
      <PdfReaderModal
        media={activePdfMedia}
        onClose={() => setActivePdfMedia(null)}
      />

      {/* Video Quality Download Modal */}
      <DownloadModal
        media={activeDownloadMedia}
        onClose={() => setActiveDownloadMedia(null)}
      />

      {/* Course Overview & Syllabus Modal */}
      <CourseOverviewModal
        detail={overviewModalData?.detail || null}
        batch={overviewModalData?.batch || null}
        onClose={() => setOverviewModalData(null)}
        onStudyClick={(id) => handleOpenCourse(id)}
      />

      {/* Global Navigation Bar */}
      <Navbar
        currentView={currentView}
        onNavigateHome={handleNavigateHome}
        onGoBack={() => {
          if (currentView === 'player') setCurrentView('course');
          else handleNavigateHome();
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        enrolledCount={enrolledIds.length}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenTelegramModal={() => setIsTelegramModalOpen(true)}
      />

      {/* VIEW: Course Content */}
      {currentView === 'course' && selectedCourseId && (
        <CourseView
          courseId={selectedCourseId}
          batchInfo={selectedBatchInfo}
          onBack={handleNavigateHome}
          onPlayVideo={handlePlayVideo}
          onOpenPdf={(media) => setActivePdfMedia(media)}
          onOpenDownload={(media) => setActiveDownloadMedia(media)}
          isEnrolled={enrolledIds.includes(String(selectedCourseId))}
          onToggleEnroll={handleToggleEnroll}
        />
      )}

      {/* VIEW: Video Player */}
      {currentView === 'player' && selectedMedia && (
        <VideoPlayerView
          media={selectedMedia}
          courseTitle={selectedBatchInfo?.title || "GB STUDY"}
          onBack={() => setCurrentView('course')}
          playlistItems={playerPlaylist}
          onSelectPlaylistItem={handleSelectPlaylistItem}
          onOpenDownloadModal={() => setActiveDownloadMedia(selectedMedia)}
        />
      )}

      {/* VIEW: Homepage (Batches Grid) */}
      {currentView === 'home' && (
        <main className="flex-1 flex flex-col pb-24">
          
          {/* Hero Banner with GB STUDY branding */}
          <section className="relative overflow-hidden bg-gradient-to-b from-zinc-950 via-[#0d0d10] to-[#0a0a0a] border-b border-white/5 py-10 sm:py-14 px-4 sm:px-6">
            {/* Ambient gold glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-48 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
              <div className="text-center lg:text-left max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/10 border border-amber-400/20 rounded-full text-amber-400 text-xs font-bold uppercase tracking-wider mb-4">
                  <Flame className="w-3.5 h-3.5" />
                  <span>Free Educational Portal</span>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight font-syne leading-tight">
                  Crack JEE & NEET with <br />
                  <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
                    GB STUDY
                  </span>
                </h1>

                <p className="text-zinc-400 text-sm sm:text-base mt-3 leading-relaxed max-w-xl">
                  Access complete Class 11th Drona JEE, Drona NEET, DPP sheets, formula notes, and lecture planners without any fees or login required.
                </p>

                {/* Quick Action Badges */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mt-6">
                  <a
                    href={TELEGRAM_CHANNEL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-400/20 btn-press"
                  >
                    <Send className="w-4 h-4" />
                    <span>Join Free Telegram Channel</span>
                  </a>

                  <button
                    onClick={() => {
                      const el = document.getElementById('batches-section');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#18181b] hover:bg-[#222226] border border-white/10 text-zinc-200 rounded-xl text-xs font-bold btn-press transition-colors"
                  >
                    <BookOpen className="w-4 h-4 text-amber-400" />
                    <span>Browse Batches</span>
                  </button>
                </div>
              </div>

              {/* Telegram Community Card */}
              <div className="w-full lg:w-96 bg-[#121212] border border-white/10 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-syne">
                      Official Telegram
                    </h3>
                    <span className="text-[11px] text-zinc-400">@GBFreestudy</span>
                  </div>
                </div>

                <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                  Join our official channel for daily test alerts, DPP solutions, video links & notes notifications.
                </p>

                <a
                  href={TELEGRAM_CHANNEL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 btn-press transition-colors shadow-md shadow-sky-500/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Join @GBFreestudy</span>
                </a>
              </div>
            </div>
          </section>

          {/* Batches Section */}
          <section id="batches-section" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full flex-1">
            
            {/* Filter Tabs Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-white/5">
              
              {/* Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap btn-press ${
                    activeTab === 'all'
                      ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                      : 'bg-[#18181b] text-zinc-400 hover:text-white border border-white/5'
                  }`}
                >
                  All Batches
                </button>

                <button
                  onClick={() => setActiveTab('jee')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap btn-press ${
                    activeTab === 'jee'
                      ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                      : 'bg-[#18181b] text-zinc-400 hover:text-white border border-white/5'
                  }`}
                >
                  JEE Main & Adv
                </button>

                <button
                  onClick={() => setActiveTab('neet')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap btn-press ${
                    activeTab === 'neet'
                      ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                      : 'bg-[#18181b] text-zinc-400 hover:text-white border border-white/5'
                  }`}
                >
                  NEET Medical
                </button>

                <button
                  onClick={() => setActiveTab('enrollments')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap btn-press flex items-center gap-1.5 ${
                    activeTab === 'enrollments'
                      ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                      : 'bg-[#18181b] text-zinc-400 hover:text-white border border-white/5'
                  }`}
                >
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  <span>My Enrollments</span>
                  {enrolledIds.length > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      activeTab === 'enrollments' ? 'bg-black text-amber-400' : 'bg-white/10 text-white'
                    }`}>
                      {enrolledIds.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Status info */}
              <div className="text-xs text-zinc-500 font-medium hidden sm:block">
                Showing {filteredBatches.length} {filteredBatches.length === 1 ? 'batch' : 'batches'}
              </div>
            </div>

            {/* Batch Cards Grid */}
            {isLoadingBatches ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="card-dark rounded-2xl h-80 animate-pulse bg-zinc-900/50 p-4 flex flex-col justify-between">
                    <div className="w-full aspect-[16/9] bg-zinc-800 rounded-xl" />
                    <div className="space-y-2">
                      <div className="h-4 bg-zinc-800 rounded w-3/4" />
                      <div className="h-3 bg-zinc-800 rounded w-1/2" />
                    </div>
                    <div className="h-9 bg-zinc-800 rounded-xl" />
                  </div>
                ))}
              </div>
            ) : filteredBatches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-[#121212] border border-white/5 rounded-2xl p-8">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <BookOpen className="w-8 h-8 text-zinc-600" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1 font-syne">
                  {activeTab === 'enrollments' ? "No Enrolled Batches Yet" : "No Batches Found"}
                </h3>
                <p className="text-xs text-zinc-400 max-w-sm mb-5">
                  {activeTab === 'enrollments'
                    ? "Click the 'ENROLL' button on any batch to save it here for quick access!"
                    : searchQuery
                    ? `No batches matching "${searchQuery}". Try searching for 'JEE', 'NEET', or 'Drona'.`
                    : "No batches are currently available in this category."}
                </p>

                {activeTab === 'enrollments' ? (
                  <button
                    onClick={() => setActiveTab('all')}
                    className="px-5 py-2.5 bg-amber-400 text-black text-xs font-bold rounded-xl btn-press"
                  >
                    Explore All Batches
                  </button>
                ) : (
                  searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="px-4 py-2 bg-zinc-800 text-white text-xs font-semibold rounded-xl"
                    >
                      Clear Search
                    </button>
                  )
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredBatches.map((batch) => (
                  <BatchCard
                    key={batch.id}
                    batch={batch}
                    isEnrolled={enrolledIds.includes(String(batch.id))}
                    onToggleEnroll={handleToggleEnroll}
                    onStudyClick={handleOpenCourse}
                    onOverviewClick={handleOpenOverview}
                  />
                ))}
              </div>
            )}

            {/* Why GB STUDY Section */}
            <div className="mt-16 pt-12 border-t border-white/5">
              <div className="text-center max-w-2xl mx-auto mb-10">
                <span className="text-amber-400 text-xs font-extrabold uppercase tracking-widest block mb-2 font-syne">
                  Student First Platform
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white font-syne">
                  Everything You Need for Class 11th
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 mt-2">
                  Built for seamless preparation with zero distractions, zero fees, and direct access.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 hover:border-amber-400/20 transition-all">
                  <div className="w-12 h-12 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center mb-4">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2 font-syne">Complete Syllabus</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Full structured chapters covering Physics, Chemistry, Mathematics, Botany, and Zoology with top educator lectures.
                  </p>
                </div>

                <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 hover:border-emerald-400/20 transition-all">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                    <Layers className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2 font-syne">DPPs & Modules</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Chapter-wise Daily Practice Problems, formula cheat sheets, and downloadable notes directly attached to every topic.
                  </p>
                </div>

                <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 hover:border-sky-400/20 transition-all">
                  <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center mb-4">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2 font-syne">No Sign Up Needed</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    No phone numbers, no OTPs, and no logins required. Click any lecture and start learning immediately on desktop or mobile.
                  </p>
                </div>
              </div>
            </div>

          </section>

        </main>
      )}

      {/* Footer */}
      <Footer
        onNavigateTab={(tab) => {
          if (currentView !== 'home') handleNavigateHome();
          setActiveTab(tab);
        }}
        onOpenTelegram={() => setIsTelegramModalOpen(true)}
      />

      {/* Mobile Bottom Floating Nav */}
      <MobileBottomNav
        currentView={currentView}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onNavigateHome={handleNavigateHome}
        enrolledCount={enrolledIds.length}
        onOpenTelegram={() => setIsTelegramModalOpen(true)}
      />

    </div>
  );
}
