# NOVA generation prototypes (images and video)

A small text-conditioned diffusion model (DDPM + classifier-free guidance) written
from scratch and trained only on pictures and clips that NOVA's own code draws
(`data.py`). No third-party images, models or APIs.

| Prototype | Data | Size | Output |
| --- | --- | --- | --- |
| Image | 18 captions: 6 colours × 3 shapes ("red circle") | ~0.6M parameters | 32×32 RGB |
| Video | 24 captions: 6 colours × 4 directions ("blue ball moving right") | ~1.0M parameters | 8 frames, 16×16 |

These are research prototypes. They prove the pipeline (data → training → sampling →
measured quality) works end to end on a CPU. They are not photo-quality and must not
be presented as a production image or video model.

    python train_gen.py --kind image --steps 3000 --out ckpt_image.pt
    python train_gen.py --kind video --steps 3000 --out ckpt_video.pt
    python evaluate_gen.py ckpt_image.pt ckpt_video.pt     # writes eval_report.json and sample sheets

Measured quality: see eval_report.json (colour, shape, motion-direction adherence and
temporal coherence, each against chance).

## What real image/video quality needs (honest)

| Goal | Typical scale | Compute (order of magnitude) |
| --- | --- | --- |
| 64×64 recognisable objects | ~1M licensed images, ~50–100M params | tens to hundreds of GPU-hours |
| 512×512 photo-like images (latent diffusion) | ~100M+ licensed image–text pairs, ~1B params | ~100,000+ GPU-hours |
| Short realistic video | ~10M+ licensed clips, multi-billion params | far beyond free resources |

Licensed data at these scales is the hardest part; the training code here scales up,
the data and GPUs are what's missing.
