<script>
	import { onMount } from 'svelte';
	import LazyImage from '$lib/components/LazyImage.svelte';
	import { defaultImages, yearList, floatingMembers } from '$lib/data';

	const isVideoSource = (url) => {
		return (
			url &&
			(url.startsWith('data:video/') ||
				url.includes('/api/video?') ||
				/\.(mp4|webm|ogg|mov)$/i.test(url.split('?')[0].split('#')[0]) ||
				/=(m\d+|dv)$/i.test(url))
		);
	};

	// States using Svelte 5 Runes
	let customImages = $state([]);
	let filterTag = $state('All');
	let selectedImage = $state(null);
	let googlePhotos = $state([]);
	let isLoading = $state(true);

	// Dragging states for floating WSM member bubbles
	let dragStates = $state(floatingMembers.map(() => ({ x: 0, y: 0, isDragging: false })));

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
			console.error('Failed to load custom images', e);
		}

		try {
			const response = await fetch('/api/photos');
			const data = await response.json();
			if (data.authenticated && data.photos) {
				googlePhotos = data.photos;
			}
		} catch (err) {
			console.error('Failed to load synced Google Photos', err);
		} finally {
			isLoading = false;
		}
	});

	// Derived values using Svelte 5 reactive getters
	const allImages = $derived([...defaultImages, ...customImages, ...googlePhotos]);

	// Derived tags with dynamic counts, grouped by type (all -> people -> semester)
	const allTags = $derived.by(() => {
		const counts = { All: allImages.length };
		allImages.forEach((img) => {
			if (img.tags && Array.isArray(img.tags)) {
				img.tags.forEach((tag) => {
					counts[tag] = (counts[tag] || 0) + 1;
				});
			}
		});

		const list = Object.entries(counts)
			.map(([name, count]) => {
				let type = 'other';
				if (name === 'All') {
					type = 'all';
				} else if (yearList.map((y) => y.toLowerCase()).includes(name.toLowerCase())) {
					type = 'year';
				}
				if (type === 'other') return null;
				return { name, count, type };
			})
			.filter(Boolean);

		return list.sort((a, b) => {
			if (a.type !== b.type) {
				const order = { all: 0, year: 1 };
				return order[a.type] - order[b.type];
			}
			if (a.type === 'year') {
				const indexA = yearList.findIndex((y) => y.toLowerCase() === a.name.toLowerCase());
				const indexB = yearList.findIndex((y) => y.toLowerCase() === b.name.toLowerCase());
				return indexA - indexB;
			}
			return a.name.localeCompare(b.name);
		});
	});

	// Filtered array based on active tag category only, randomized on filter change / landing
	const filteredImages = $derived.by(() => {
		const list = allImages.filter((img) => {
			return filterTag === 'All' || (img.tags && img.tags.includes(filterTag));
		});

		// Fisher-Yates shuffle to randomize the visual board cards
		const shuffled = [...list];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		return shuffled;
	});

	// Deletion logic for custom-added images
	function deleteImage(id) {
		if (!confirm('Are you sure you want to delete this custom image?')) return;
		customImages = customImages.filter((img) => img.id !== id);
		try {
			localStorage.setItem('wsm_custom_images', JSON.stringify(customImages));
		} catch (err) {
			console.error('Failed to save after deletion', err);
		}
		if (selectedImage && selectedImage.id === id) {
			selectedImage = null;
		}
	}

	// Global key listener
	function handleKeydown(e) {
		if (e.key === 'Escape') {
			selectedImage = null;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Background Ambient Glowing Elements -->
<div class="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-slate-950">
	<div
		class="absolute -top-48 -left-48 h-[500px] w-[500px] animate-pulse rounded-full bg-indigo-500/10 blur-[150px]"
		style="animation-duration: 10s;"
	></div>
	<div
		class="absolute top-1/3 -right-48 h-[400px] w-[400px] animate-pulse rounded-full bg-violet-600/10 blur-[130px]"
		style="animation-duration: 14s;"
	></div>
	<div
		class="absolute -bottom-48 left-1/4 h-[600px] w-[600px] animate-pulse rounded-full bg-fuchsia-500/5 blur-[180px]"
		style="animation-duration: 18s;"
	></div>
</div>

<!-- Floating WSM Member Head Bubbles Group Layer -->
<div class="pointer-events-none fixed inset-0 z-20 overflow-hidden opacity-[0.20]">
	{#each floatingMembers as member, index (member.name)}
		<div
			class="pointer-events-auto absolute cursor-grab select-none active:cursor-grabbing {member.size}"
			style="top: {member.top}; left: {member.left}; transform: translate3d({dragStates[index]
				.x}px, {dragStates[index].y}px, 0);"
			onmousedown={(e) => handleStart(e, index)}
			ontouchstart={(e) => handleStart(e, index)}
			role="presentation"
		>
			<div
				class="animate-float h-full w-full overflow-hidden rounded-full bg-slate-950 brightness-[0.8] contrast-[0.9] grayscale"
				style="animation-delay: {member.delay}; animation-duration: {member.duration};"
			>
				<img
					src={member.src}
					alt={member.name}
					class="pointer-events-none h-full w-full object-cover select-none"
				/>
			</div>
		</div>
	{/each}
</div>

<main
	class="pointer-events-none relative z-30 mx-auto flex min-h-screen max-w-7xl flex-col px-4 pt-16 pb-2 sm:px-6 lg:px-8"
>
	<!-- Header Section -->
	<header
		class="pointer-events-auto mb-12 flex flex-col items-center justify-center text-center select-none"
	>
		<img
			src="/fasilkom.png"
			alt="Fasilkom UI Logo"
			class="mr-3 mb-5 h-10 w-auto cursor-pointer object-contain opacity-80 brightness-95 filter transition-all duration-300 select-none hover:scale-105 hover:opacity-100 hover:brightness-100 sm:h-12"
		/>
		<h1
			class="font-display mb-3 bg-linear-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-5xl font-extrabold tracking-[0.35em] text-transparent uppercase drop-shadow-[0_2px_10px_rgba(139,92,246,0.15)] filter sm:text-7xl"
		>
			W S M
		</h1>
		<p class="font-sans text-xs font-medium tracking-[0.25em] text-slate-500 uppercase">
			Wang Siu Mek • FASILKOM UI 2022
		</p>
	</header>

	<!-- Tag Pills Category Row -->
	<section class="pointer-events-auto mx-auto mb-12 w-full max-w-5xl">
		<div class="no-scrollbar flex items-center justify-center gap-2 overflow-x-auto pb-2">
			{#each allTags as tag (tag.name)}
				<button
					onclick={() => (filterTag = tag.name)}
					class="flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold tracking-wider whitespace-nowrap uppercase transition-all duration-300 select-none
          {filterTag === tag.name
						? tag.type === 'people'
							? 'border-indigo-500 bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.35)]'
							: tag.type === 'year'
								? 'border-fuchsia-500 bg-fuchsia-600 text-white shadow-[0_0_15px_rgba(217,70,239,0.35)]'
								: 'border-violet-500 bg-violet-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.35)]'
						: tag.type === 'people'
							? 'border-indigo-500/10 bg-indigo-950/20 text-indigo-300 hover:border-indigo-500/30 hover:bg-indigo-950/40 hover:text-indigo-200'
							: tag.type === 'year'
								? 'border-fuchsia-500/10 bg-fuchsia-950/20 text-fuchsia-300 hover:border-fuchsia-500/30 hover:bg-fuchsia-950/40 hover:text-fuchsia-200'
								: 'border-white/5 bg-slate-900/50 text-slate-400 hover:border-white/10 hover:bg-slate-900 hover:text-slate-200'}"
				>
					<span>#{tag.name}</span>
				</button>
			{/each}
		</div>
	</section>

	<!-- Masonry Visual Board -->
	<section class="pointer-events-auto w-full grow">
		{#if isLoading}
			<!-- Skeleton Loading Board -->
			<div
				class="box-border w-full columns-2 gap-4 [column-fill:balance] sm:columns-2 sm:gap-6 md:columns-3 lg:columns-4"
			>
				{#each [0, 1, 2, 3, 4, 5, 6, 7] as index (index)}
					{@const aspectRatios = ['h-64', 'h-48', 'h-80', 'h-56', 'h-72', 'h-52', 'h-96', 'h-60']}
					{@const height = aspectRatios[index % aspectRatios.length]}
					{@const rotation = (((index * 7) % 5) - 2) / 10}
					<div
						class="w-full {height} mb-4 flex animate-pulse flex-col justify-end gap-3 rounded-2xl border border-white/5 bg-slate-900/40 p-4 sm:mb-6"
						style="transform: rotate({rotation}deg);"
					>
						<div class="h-3.5 w-1/2 rounded-full bg-slate-800"></div>
						<div class="h-2 w-3/4 rounded-full bg-slate-800/60"></div>
						<div class="mt-2 flex gap-1.5">
							<div class="h-4 w-10 rounded-full bg-slate-800/40"></div>
							<div class="h-4 w-12 rounded-full bg-slate-800/40"></div>
						</div>
					</div>
				{/each}
			</div>
		{:else if filteredImages.length === 0}
			<div class="mx-auto max-w-md px-6 py-20 text-center select-none">
				<h3 class="text-sm font-medium text-slate-400">No visuals found</h3>
			</div>
		{:else}
			<!-- Pinterest Column layout -->
			<div
				class="box-border w-full columns-2 gap-4 [column-fill:balance] sm:columns-2 sm:gap-6 md:columns-3 lg:columns-4"
			>
				{#each filteredImages as img (img.id)}
					<LazyImage
						src={img.url}
						title={img.title}
						description={img.description}
						tags={img.tags}
						ratio={img.ratio}
						onclick={() => (selectedImage = img)}
					/>
				{/each}
			</div>
		{/if}
	</section>

	<!-- Footer -->
	<footer
		class="pointer-events-none mt-8 w-full border-t border-white/5 pt-3 pb-0 text-right select-none"
	>
		<div class="flex flex-col items-end justify-center gap-0.5">
			<h2
				class="font-display bg-linear-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-base font-extrabold tracking-tight text-transparent"
			>
				See You on Top
			</h2>
			<p class="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">2022 — 2026</p>
		</div>
	</footer>
</main>

<!-- Lightbox Detailed Modal Overlay -->
{#if selectedImage}
	<div
		class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 p-4 backdrop-blur-2xl transition-all duration-300 sm:p-6 md:p-8"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={() => (selectedImage = null)}
	>
		<!-- Top Bar Controls inside Modal (Minimalist floating bar) -->
		<div
			class="pointer-events-none absolute top-4 right-4 left-4 z-50 flex items-center justify-end select-none"
		>
			<div class="pointer-events-auto flex items-center gap-3">
				<!-- Delete button for custom ones -->
				{#if selectedImage.id.toString().startsWith('custom-')}
					<button
						onclick={(e) => {
							e.stopPropagation();
							deleteImage(selectedImage.id);
						}}
						class="flex cursor-pointer items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-950/40 px-3 py-1.5 text-xs font-bold tracking-wider text-rose-400 uppercase transition-all duration-300 hover:border-rose-500/40 hover:bg-rose-950/60"
						aria-label="Remove image"
					>
						<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
							/>
						</svg>
						<span class="hidden md:inline">Remove</span>
					</button>
				{/if}

				<!-- Close Button -->
				<button
					onclick={() => (selectedImage = null)}
					class="pointer-events-auto rounded-full border border-white/5 bg-slate-900/60 p-2 text-slate-400 backdrop-blur-md transition-all hover:bg-slate-800/60 hover:text-white"
					aria-label="Close image"
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>
		</div>

		<!-- Immersive Visual Container (Static non-zoomable) -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="relative flex max-h-[85vh] max-w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-2xl"
			onclick={(e) => e.stopPropagation()}
		>
			{#if isVideoSource(selectedImage.url)}
				<!-- svelte-ignore a11y_media_has_caption -->
				<video
					src={selectedImage.url}
					class="max-h-[80vh] max-w-[90vw] rounded-xl object-contain"
					controls
					preload="metadata"
					autoplay
					loop
					playsinline
				></video>
			{:else}
				<img
					src={selectedImage.url}
					alt={selectedImage.title}
					referrerpolicy="no-referrer"
					class="pointer-events-none max-h-[80vh] max-w-[90vw] object-contain select-none"
				/>
			{/if}
		</div>

		<!-- Tags overlay list at the very bottom center -->
		<div class="absolute bottom-6 flex max-w-lg flex-wrap justify-center gap-2 px-4">
			{#each selectedImage.tags as tag (tag)}
				<span
					class="rounded-full border border-white/5 bg-slate-900/60 px-3.5 py-1.5 text-xs font-semibold tracking-wider text-slate-300 uppercase backdrop-blur-md select-none"
				>
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
		-ms-overflow-style: none; /* IE and Edge */
		scrollbar-width: none; /* Firefox */
	}

	@keyframes float-gentle {
		0%,
		100% {
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
