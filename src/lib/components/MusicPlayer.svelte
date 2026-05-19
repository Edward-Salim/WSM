<script>
	import { CirclePause, CirclePlay } from '@lucide/svelte';
	import { onMount, tick, onDestroy } from 'svelte';

	let tracks = $state([]);

	let currentTrackIndex = $state(0);
	let isPlaying = $state(false);
	let progress = $state(0);
	let duration = $state(0);
	let audio = $state(null);
	let hasLoadedTracks = $state(false);
	let pendingAutoplay = $state(false);

	// Auto Scroll States & Engine
	let isAutoScrolling = $state(false);
	let autoScrollInterval = null;
	let isAtBottom = $state(false);

	function checkScrollPosition() {
		if (typeof window === 'undefined') return;
		// Check if we are near/at the bottom of the page (within 10px)
		isAtBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 10);
	}

	function toggleAutoScroll() {
		if (isAtBottom) {
			window.scrollTo({ top: 0, behavior: 'smooth' });
			isAutoScrolling = false;
			stopAutoScroll();
			return;
		}

		isAutoScrolling = !isAutoScrolling;
		if (isAutoScrolling) {
			startAutoScroll();
		} else {
			stopAutoScroll();
		}
	}

	let currentScrollY = 0;

	// Ease-in curve: ramps from 0→1 over ~800ms so scroll feels like it has inertia
	function easeIn(t) {
		// Cubic ease-in clamped to [0, 1]
		return Math.min(t * t * t, 1);
	}

	function startAutoScroll() {
		if (typeof window === 'undefined') return;
		stopAutoScroll();

		currentScrollY = window.scrollY;
		let lastTimestamp = null;
		let startTimestamp = null;
		const RAMP_MS = 800; // ms to reach full speed
		const FULL_SPEED = 0.22; // px/ms at full speed

		function scrollStep(timestamp) {
			if (!isAutoScrolling) return;

			if (lastTimestamp === null) {
				lastTimestamp = timestamp;
				startTimestamp = timestamp;
				autoScrollInterval = requestAnimationFrame(scrollStep);
				return;
			}

			const elapsed = Math.min(timestamp - lastTimestamp, 64);
			lastTimestamp = timestamp;

			// Ease-in ramp: speed goes 0 → FULL_SPEED over RAMP_MS
			const age = timestamp - startTimestamp;
			const speed = FULL_SPEED * easeIn(age / RAMP_MS);

			// Re-sync if user manually scrolled
			if (Math.abs(window.scrollY - currentScrollY) > 8) {
				currentScrollY = window.scrollY;
			}

			currentScrollY += elapsed * speed;

			// Object form forces the browser to honour the float (no integer quantization)
			window.scrollTo({ left: 0, top: currentScrollY, behavior: 'instant' });

			// Stop at bottom
			const isBottom =
				window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
			if (isBottom) {
				isAutoScrolling = false;
				stopAutoScroll();
				isAtBottom = true;
				return;
			}

			autoScrollInterval = requestAnimationFrame(scrollStep);
		}

		autoScrollInterval = requestAnimationFrame(scrollStep);
	}

	function stopAutoScroll() {
		if (autoScrollInterval) {
			cancelAnimationFrame(autoScrollInterval);
			autoScrollInterval = null;
		}
	}

	onDestroy(() => {
		stopAutoScroll();
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', checkScrollPosition);
		}
	});

	const currentTrack = $derived(tracks[currentTrackIndex] ?? null);

	function shuffleTracks(list) {
		const shuffled = [...list];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		return shuffled;
	}

	onMount(async () => {
		try {
			const response = await fetch('/api/music');
			const data = await response.json();
			tracks = Array.isArray(data.tracks) ? shuffleTracks(data.tracks) : [];
		} catch (error) {
			console.error('Failed to load music tracks:', error);
			tracks = [];
		} finally {
			hasLoadedTracks = true;
		}

		await tick();
		if (tracks.length > 0 && audio) {
			try {
				audio.load();
				await audio.play();
				isPlaying = true;
			} catch (error) {
				pendingAutoplay = true;
				console.warn('Autoplay blocked or play interrupted:', error);
			}
		}

		if (typeof window !== 'undefined') {
			window.addEventListener('resize', checkScrollPosition);
			checkScrollPosition();
		}
	});

	async function tryPendingAutoplay() {
		if (!pendingAutoplay || !audio || !currentTrack || isPlaying) return;

		try {
			await audio.play();
			isPlaying = true;
			pendingAutoplay = false;
		} catch (error) {
			console.warn('Deferred autoplay blocked or play interrupted:', error);
		}
	}

	function togglePlay() {
		if (!audio || !currentTrack) return;
		if (isPlaying) {
			audio.pause();
			isPlaying = false;
			pendingAutoplay = false;
		} else {
			audio
				.play()
				.then(() => {
					isPlaying = true;
					pendingAutoplay = false;
				})
				.catch((err) => {
					console.warn('Autoplay blocked or play interrupted:', err);
				});
		}
	}

	function nextTrack() {
		if (tracks.length === 0) return;
		currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
		isPlaying = false;
		progress = 0;
		setTimeout(() => {
			if (audio && tracks[currentTrackIndex]) {
				audio.src = tracks[currentTrackIndex].src;
				audio.load();
				audio
					.play()
					.then(() => {
						isPlaying = true;
						pendingAutoplay = false;
					})
					.catch((err) => console.warn(err));
			}
		}, 100);
	}

	function prevTrack() {
		if (tracks.length === 0) return;
		currentTrackIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
		isPlaying = false;
		progress = 0;
		setTimeout(() => {
			if (audio && tracks[currentTrackIndex]) {
				audio.src = tracks[currentTrackIndex].src;
				audio.load();
				audio
					.play()
					.then(() => {
						isPlaying = true;
						pendingAutoplay = false;
					})
					.catch((err) => console.warn(err));
			}
		}, 100);
	}

	function handleTimeUpdate() {
		if (!audio) return;
		progress = audio.currentTime;
	}

	function handleLoadedMetadata() {
		if (!audio) return;
		duration = Number.isFinite(audio.duration) ? audio.duration : 0;
	}

	function handleAudioEnded() {
		nextTrack();
	}

	function handleProgressClick(e) {
		if (!audio || duration === 0) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const clickX = e.clientX - rect.left;
		const width = rect.width;
		const clickPercent = clickX / width;
		audio.currentTime = clickPercent * duration;
		progress = audio.currentTime;
	}

</script>

<svelte:window
	onclick={tryPendingAutoplay}
	onkeydown={tryPendingAutoplay}
	ontouchstart={tryPendingAutoplay}
	onwheel={tryPendingAutoplay}
	onscroll={() => {
		tryPendingAutoplay();
		checkScrollPosition();
	}}
/>

<div class="pointer-events-auto fixed bottom-6 left-1/2 z-40 flex w-[calc(100%-2.5rem)] max-w-[24rem] items-stretch gap-3 -translate-x-1/2 select-none">
	<!-- Audio element -->
	<audio
		bind:this={audio}
		src={currentTrack?.src}
		autoplay
		ontimeupdate={handleTimeUpdate}
		onloadedmetadata={handleLoadedMetadata}
		onended={handleAudioEnded}
	></audio>

	<!-- Music Player Main Panel -->
	<div
		class="group flex flex-1 min-w-0 items-center gap-3.5 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 shadow-2xl shadow-indigo-950/30 backdrop-blur-xl transition-all duration-500 hover:border-violet-500/30"
	>
		<div
			class="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-slate-900 shadow-lg shadow-black/40"
		>
			<div
				class="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-tr from-slate-950 via-slate-800 to-slate-950 {isPlaying
					? 'animate-spin-slow'
					: ''}"
				style="animation-duration: 6s; transform-origin: center;"
			>
				<div class="absolute inset-1 rounded-full border border-white/5"></div>
				<div class="absolute inset-2.5 rounded-full border border-white/5"></div>
				<div
					class="flex h-4 w-4 items-center justify-center rounded-full border border-indigo-400/30 bg-indigo-500/20"
				>
					<div class="h-1.5 w-1.5 rounded-full bg-slate-950"></div>
				</div>
			</div>

			{#if isPlaying}
				<div class="absolute inset-0 flex items-center justify-center bg-violet-600/10">
					<svg
						class="h-5 w-5 text-indigo-300"
						fill="currentColor"
						viewBox="0 0 20 20"
					>
						<path
							d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"
						/>
					</svg>
				</div>
			{/if}
		</div>

		<div class="flex min-w-0 flex-1 flex-col gap-1.5">
			<button
				type="button"
				class="flex min-w-0 flex-col items-start text-left"
				onclick={togglePlay}
				aria-label={isPlaying ? 'Pause current track' : 'Play current track'}
			>
				<span class="truncate text-xs font-bold tracking-wide text-white">
					{currentTrack?.title ?? (hasLoadedTracks ? 'No tracks found' : 'Loading tracks...')}
				</span>
				<span class="mt-0.5 truncate text-[10px] tracking-wide text-white/75">
					{#if currentTrack}
						{currentTrack.artist}
					{:else if hasLoadedTracks}
						Add audio files to `static/music`
					{:else}
						Scanning `static/music`
					{/if}
				</span>
			</button>

			<button
				type="button"
				class="relative h-1 w-full cursor-pointer overflow-hidden rounded-full bg-white/10"
				onclick={handleProgressClick}
				aria-label="Seek track"
				disabled={!currentTrack}
			>
				<div
					class="h-full rounded-full bg-linear-to-r from-violet-400 to-fuchsia-400"
					style="width: {(progress / (duration || 1)) * 100}%"
				></div>
			</button>
		</div>

		<div class="flex shrink-0 items-center gap-1 border-l border-white/5 pl-2.5">
			<button
				onclick={prevTrack}
				class="cursor-pointer rounded-full p-1 text-white/70 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40"
				aria-label="Previous track"
				disabled={tracks.length < 2}
			>
				<svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
					<path
						d="M8.445 14.83L3 10l5.445-4.83a1 1 0 011.555.83v2.84l5.445-4.83A1 1 0 0117 4.83v10.34a1 1 0 01-1.555.83L10 11.16v2.84a1 1 0 01-1.555.83z"
					/>
				</svg>
			</button>

			<button
				onclick={togglePlay}
				class="cursor-pointer rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-300 transition-all hover:scale-105 hover:bg-indigo-500/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
				aria-label={isPlaying ? 'Pause' : 'Play'}
				disabled={!currentTrack}
			>
				{#if isPlaying}
					<CirclePause class="h-4 w-4" strokeWidth={2} />
				{:else}
					<CirclePlay class="h-4 w-4" strokeWidth={2} />
				{/if}
			</button>

			<button
				onclick={nextTrack}
				class="cursor-pointer rounded-full p-1 text-white/70 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40"
				aria-label="Next track"
				disabled={tracks.length < 2}
			>
				<svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
					<path
						d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.16v2.84A1 1 0 0011.555 15l5-4a1 1 0 000-1.664l-5-4A1 1 0 0010 6.16v2.84L4.555 5.168z"
					/>
				</svg>
			</button>
		</div>
	</div>

	<!-- Auto Scroll Toggle Button -->
	<button
		onclick={toggleAutoScroll}
		class="flex w-12 shrink-0 cursor-pointer items-center justify-center rounded-2xl border transition-all duration-500 shadow-2xl backdrop-blur-xl
		{isAutoScrolling
			? 'border-fuchsia-500/40 bg-fuchsia-950/80 text-fuchsia-300 shadow-fuchsia-950/40'
			: 'border-white/10 bg-slate-950/80 text-slate-400 hover:border-violet-500/30 hover:text-white shadow-black/40'}"
		aria-label={isAutoScrolling ? 'Stop Auto Scroll' : isAtBottom ? 'Scroll to Top' : 'Start Auto Scroll'}
	>
		<svg
			class="h-5 w-5 {isAutoScrolling ? 'animate-bounce-slow text-fuchsia-400' : ''}"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2.5"
		>
			{#if isAutoScrolling}
				<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
			{:else if isAtBottom}
				<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
			{:else}
				<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
			{/if}
		</svg>
	</button>
</div>

<style>
	@keyframes spin-slow {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	:global(.animate-spin-slow) {
		animation: spin-slow 10s linear infinite;
	}

	@keyframes bounce-slow {
		0%, 100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(3px);
		}
	}

	:global(.animate-bounce-slow) {
		animation: bounce-slow 1.4s ease-in-out infinite;
	}
</style>
