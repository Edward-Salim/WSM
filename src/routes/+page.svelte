<script>
  import { onMount } from 'svelte';
  import LazyImage from '$lib/components/LazyImage.svelte';
  import { defaultImages, peopleList, yearList, floatingMembers } from '$lib/data';

  const isVideoSource = (url) => {
    return url && (
      url.startsWith('data:video/') || 
      /\.(mp4|webm|ogg|mov)$/i.test(url.split('?')[0].split('#')[0]) ||
      /=(m\d+|dv)$/i.test(url)
    );
  };

  // States using Svelte 5 Runes
  let customImages = $state([]);
  let filterTag = $state('All');
  let selectedImage = $state(null);
  let googlePhotos = $state([]);
  let isAdding = $state(false);
  let isLoading = $state(true);


  // Form states for adding custom image
  let newUrl = $state('');
  let newTagsString = $state('');
  let newRatio = $state('2/3');
  let dragActive = $state(false);
  let fileInput = $state(null);

  // Dragging states for floating WSM member bubbles
  let dragStates = $state(
    floatingMembers.map(() => ({ x: 0, y: 0, isDragging: false }))
  );

  let activeIndex = null;
  let startX = 0;
  let startY = 0;
  let startDragX = 0;
  let startDragY = 0;

  function handleStart(event, index) {
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    
    activeIndex = index;
    startX = clientX;
    startY = clientY;
    startDragX = dragStates[index].x;
    startDragY = dragStates[index].y;
    dragStates[index].isDragging = true;
    
    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
    }
  }

  function handleMove(event) {
    if (activeIndex === null) return;
    if (event.cancelable) event.preventDefault();
    
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    
    const dx = clientX - startX;
    const dy = clientY - startY;
    
    dragStates[activeIndex].x = startDragX + dx;
    dragStates[activeIndex].y = startDragY + dy;
  }

  function handleEnd() {
    if (activeIndex !== null) {
      dragStates[activeIndex].isDragging = false;
      activeIndex = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    }
  }

  // Load custom images from localStorage and Google Photos on mount
  onMount(async () => {
    try {
      const saved = localStorage.getItem('wsm_custom_images');
      if (saved) {
        customImages = JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load custom images", e);
    }

    try {
      const response = await fetch('/api/photos');
      const data = await response.json();
      if (data.authenticated && data.photos) {
        googlePhotos = data.photos;
      }
    } catch (err) {
      console.error("Failed to load synced Google Photos", err);
    } finally {
      isLoading = false;
    }
  });

  // Derived values using Svelte 5 reactive getters
  const allImages = $derived([...defaultImages, ...customImages, ...googlePhotos]);

  // Derived tags with dynamic counts, grouped by type (all -> people -> semester)
  const allTags = $derived.by(() => {
    const counts = { 'All': allImages.length };
    allImages.forEach(img => {
      if (img.tags && Array.isArray(img.tags)) {
        img.tags.forEach(tag => {
          counts[tag] = (counts[tag] || 0) + 1;
        });
      }
    });

    const list = Object.entries(counts).map(([name, count]) => {
      let type = 'other';
      if (name === 'All') {
        type = 'all';
      } else if (yearList.map(y => y.toLowerCase()).includes(name.toLowerCase())) {
        type = 'year';
      }
      if (type === 'other') return null;
      return { name, count, type };
    }).filter(Boolean);

    return list.sort((a, b) => {
      if (a.type !== b.type) {
        const order = { 'all': 0, 'year': 1 };
        return order[a.type] - order[b.type];
      }
      if (a.type === 'year') {
        const indexA = yearList.findIndex(y => y.toLowerCase() === a.name.toLowerCase());
        const indexB = yearList.findIndex(y => y.toLowerCase() === b.name.toLowerCase());
        return indexA - indexB;
      }
      return a.name.localeCompare(b.name);
    });
  });

  // Filtered array based on active tag category only
  const filteredImages = $derived.by(() => {
    return allImages.filter(img => {
      return filterTag === 'All' || (img.tags && img.tags.includes(filterTag));
    });
  });

  // Action to add dynamic image to localStorage
  function addImage(e) {
    e.preventDefault();
    if (!newUrl) return;

    const tagsArray = newTagsString
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0)
      .map(t => t.charAt(0).toUpperCase() + t.slice(1)); // Format tags nicely

    const newImg = {
      id: 'custom-' + Date.now(),
      title: 'Visual Board Item',
      description: '',
      url: newUrl,
      tags: tagsArray.length > 0 ? tagsArray : ['General'],
      ratio: newRatio
    };

    customImages = [newImg, ...customImages];
    
    try {
      localStorage.setItem('wsm_custom_images', JSON.stringify(customImages));
    } catch (err) {
      console.error("Failed to save custom image", err);
    }

    // Reset fields & close modal
    newUrl = '';
    newTagsString = '';
    newRatio = '2/3';
    isAdding = false;
  }

  // Handle file drops and uploads
  function handleDragOver(e) {
    e.preventDefault();
    dragActive = true;
  }

  function handleDragLeave() {
    dragActive = false;
  }

  function processFile(file) {
    if (!file || (!file.type.startsWith('image/') && !file.type.startsWith('video/'))) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      newUrl = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    dragActive = false;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }

  function handleFileChange(e) {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  }

  // Deletion logic for custom-added images
  function deleteImage(id) {
    if (!confirm('Are you sure you want to delete this custom image?')) return;
    customImages = customImages.filter(img => img.id !== id);
    try {
      localStorage.setItem('wsm_custom_images', JSON.stringify(customImages));
    } catch (err) {
      console.error("Failed to save after deletion", err);
    }
    if (selectedImage && selectedImage.id === id) {
      selectedImage = null;
    }
  }

  // Global key listener
  function handleKeydown(e) {
    if (e.key === 'Escape') {
      selectedImage = null;
      isAdding = false;
    }
  }

  // Helper to change tags from detail view
  function selectTagAndClose(tag) {
    filterTag = tag;
    selectedImage = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Background Ambient Glowing Elements -->
<div class="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-slate-950">
  <div class="absolute -top-48 -left-48 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[150px] animate-pulse" style="animation-duration: 10s;"></div>
  <div class="absolute top-1/3 -right-48 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[130px] animate-pulse" style="animation-duration: 14s;"></div>
  <div class="absolute -bottom-48 left-1/4 w-[600px] h-[600px] bg-fuchsia-500/5 rounded-full blur-[180px] animate-pulse" style="animation-duration: 18s;"></div>

</div>

<!-- Floating WSM Member Head Bubbles Group Layer -->
<div class="fixed inset-0 pointer-events-none overflow-hidden z-20 opacity-[0.20]">
  {#each floatingMembers as member, index (member.name)}
    <div 
      class="absolute pointer-events-auto cursor-grab active:cursor-grabbing select-none {member.size}"
      style="top: {member.top}; left: {member.left}; transform: translate3d({dragStates[index].x}px, {dragStates[index].y}px, 0);"
      onmousedown={(e) => handleStart(e, index)}
      ontouchstart={(e) => handleStart(e, index)}
      role="presentation"
    >
      <div 
        class="w-full h-full rounded-full bg-slate-950 overflow-hidden grayscale contrast-[0.9] brightness-[0.8] animate-float"
        style="animation-delay: {member.delay}; animation-duration: {member.duration};"
      >
        <img src={member.src} alt={member.name} class="w-full h-full object-cover select-none pointer-events-none" />
      </div>
    </div>
  {/each}
</div>

<main class="min-h-screen relative z-30 pt-16 pb-2 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col pointer-events-none">
  <!-- Header Section -->
  <header class="text-center mb-12 select-none flex flex-col items-center justify-center pointer-events-auto">
    <img 
      src="/fasilkom.png" 
      alt="Fasilkom UI Logo" 
      class="h-10 sm:h-12 w-auto mb-5 object-contain filter brightness-95 opacity-80 hover:opacity-100 hover:brightness-100 hover:scale-105 transition-all duration-300 select-none cursor-pointer mr-4"
    />
    <h1 class="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent font-extrabold tracking-[0.35em] text-5xl sm:text-7xl uppercase mb-3 filter drop-shadow-[0_2px_10px_rgba(139,92,246,0.15)] font-display">
      W S M
    </h1>
    <p class="text-slate-500 font-sans text-xs tracking-[0.25em] uppercase font-medium">
      Wang Siu Mek • FASILKOM UI 2022
    </p>

  </header>

  <!-- Tag Pills Category Row -->
  <section class="w-full max-w-5xl mx-auto mb-12 pointer-events-auto">
    <div class="flex items-center justify-center gap-2 overflow-x-auto pb-2 no-scrollbar">
      {#each allTags as tag (tag.name)}
        <button
          onclick={() => filterTag = tag.name}
          class="px-4 py-2 text-xs font-semibold rounded-full border transition-all duration-300 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer whitespace-nowrap select-none 
          {filterTag === tag.name 
            ? (tag.type === 'people' 
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.35)]' 
                : tag.type === 'year'
                ? 'bg-fuchsia-600 border-fuchsia-500 text-white shadow-[0_0_15px_rgba(217,70,239,0.35)]'
                : 'bg-violet-600 border-violet-500 text-white shadow-[0_0_15px_rgba(139,92,246,0.35)]') 
            : (tag.type === 'people'
                ? 'bg-indigo-950/20 border-indigo-500/10 text-indigo-300 hover:border-indigo-500/30 hover:bg-indigo-950/40 hover:text-indigo-200'
                : tag.type === 'year'
                ? 'bg-fuchsia-950/20 border-fuchsia-500/10 text-fuchsia-300 hover:border-fuchsia-500/30 hover:bg-fuchsia-950/40 hover:text-fuchsia-200'
                : 'bg-slate-900/50 border-white/5 text-slate-400 hover:border-white/10 hover:bg-slate-900 hover:text-slate-200')}"
        >
          <span>#{tag.name}</span>
        </button>
      {/each}
    </div>
  </section>

  <!-- Masonry Visual Board -->
  <section class="flex-grow w-full pointer-events-auto">
    {#if isLoading}
      <!-- Skeleton Loading Board -->
      <div class="columns-2 sm:columns-2 md:columns-3 lg:columns-4 gap-4 sm:gap-6 [column-fill:_balance] box-border w-full">
        {#each [0, 1, 2, 3, 4, 5, 6, 7] as index}
          {@const aspectRatios = ['h-64', 'h-48', 'h-80', 'h-56', 'h-72', 'h-52', 'h-96', 'h-60']}
          {@const height = aspectRatios[index % aspectRatios.length]}
          {@const rotation = ((index * 7) % 5 - 2) / 10}
          <div 
            class="w-full {height} mb-4 sm:mb-6 rounded-2xl bg-slate-900/40 border border-white/5 p-4 flex flex-col justify-end gap-3 animate-pulse"
            style="transform: rotate({rotation}deg);"
          >
            <div class="w-1/2 h-3.5 bg-slate-800 rounded-full"></div>
            <div class="w-3/4 h-2 bg-slate-800/60 rounded-full"></div>
            <div class="flex gap-1.5 mt-2">
              <div class="w-10 h-4 bg-slate-800/40 rounded-full"></div>
              <div class="w-12 h-4 bg-slate-800/40 rounded-full"></div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      {#if filteredImages.length === 0}
        <div class="text-center py-20 max-w-md mx-auto px-6 select-none">
          <h3 class="text-sm font-medium text-slate-400">No visuals found</h3>
        </div>
      {:else}
        <!-- Pinterest Column layout -->
        <div class="columns-2 sm:columns-2 md:columns-3 lg:columns-4 gap-4 sm:gap-6 [column-fill:_balance] box-border w-full">
          {#each filteredImages as img (img.id)}
            <LazyImage 
              src={img.url}
              title={img.title}
              description={img.description}
              tags={img.tags}
              ratio={img.ratio}
              onclick={() => selectedImage = img}
            />
          {/each}
        </div>
      {/if}
    {/if}
  </section>

  <!-- Footer -->
  <footer class="w-full mt-8 pb-0 border-t border-white/5 pt-3 text-center select-none pointer-events-none">
    <div class="flex flex-col items-center justify-center gap-0.5">
      <h2 class="text-base font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 font-display">
        See You on Top
      </h2>
      <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
        2022 — 2026
      </p>
    </div>
  </footer>
</main>

<!-- Lightbox Detailed Modal Overlay -->
{#if selectedImage}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div 
    class="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 bg-slate-950/95 backdrop-blur-2xl transition-all duration-300"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={() => selectedImage = null}
  >
    <!-- Top Bar Controls inside Modal (Minimalist floating bar) -->
    <div 
      class="absolute top-4 left-4 right-4 z-50 flex items-center justify-end pointer-events-none select-none"
    >
      <div class="flex items-center gap-3 pointer-events-auto">
        <!-- Delete button for custom ones -->
        {#if selectedImage.id.toString().startsWith('custom-')}
          <button 
            onclick={(e) => { e.stopPropagation(); deleteImage(selectedImage.id); }}
            class="flex items-center gap-1.5 px-3 py-1.5 text-rose-400 bg-rose-950/40 hover:bg-rose-950/60 border border-rose-500/20 hover:border-rose-500/40 rounded-full text-xs font-bold transition-all duration-300 uppercase tracking-wider cursor-pointer"
            aria-label="Remove image"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span class="hidden md:inline">Remove</span>
          </button>
        {/if}

        <!-- Close Button -->
        <button 
          onclick={() => selectedImage = null}
          class="text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800/60 border border-white/5 p-2 rounded-full backdrop-blur-md transition-all pointer-events-auto"
          aria-label="Close image"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Immersive Visual Container (Static non-zoomable) -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
      class="relative max-w-full max-h-[85vh] overflow-hidden rounded-2xl border border-white/10 shadow-2xl bg-black/30 flex items-center justify-center"
      onclick={(e) => e.stopPropagation()}
    >
      {#if isVideoSource(selectedImage.url)}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video
          src={selectedImage.url}
          referrerpolicy="no-referrer"
          class="max-w-[90vw] max-h-[80vh] object-contain rounded-xl"
          controls
          autoplay
          loop
          playsinline
        ></video>
      {:else}
        <img 
          src={selectedImage.url} 
          alt={selectedImage.title}
          referrerpolicy="no-referrer"
          class="max-w-[90vw] max-h-[80vh] object-contain select-none pointer-events-none"
        />
      {/if}
    </div>

    <!-- Tags overlay list at the very bottom center -->
    <div class="absolute bottom-6 flex flex-wrap justify-center gap-2 max-w-lg px-4">
      {#each selectedImage.tags as tag (tag)}
        <span class="px-3.5 py-1.5 text-xs font-semibold bg-slate-900/60 backdrop-blur-md border border-white/5 text-slate-300 rounded-full uppercase tracking-wider select-none">
          #{tag}
        </span>
      {/each}
    </div>
  </div>
{/if}

<style>
  /* Hide scrollbar for Chrome, Safari and Opera */
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  /* Hide scrollbar for IE, Edge and Firefox */
  .no-scrollbar {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
  }

  @keyframes float-gentle {
    0%, 100% {
      transform: translateY(0) rotate(0deg);
    }
    50% {
      transform: translateY(-20px) rotate(5deg);
    }
  }
  .animate-float {
    animation-name: float-gentle;
    animation-iteration-count: infinite;
    animation-timing-function: ease-in-out;
  }
</style>
