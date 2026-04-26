import re
import sys
from pathlib import Path

color_map = {
    '950': '#0c0b09',
    '900': '#141210',
    '800': '#1a1814',
    '700': '#2a2520',
    '600': '#4a443c',
    '500': '#5c564e',
    '400': '#8a837a',
    '300': '#a39b90',
    '200': '#d5cfc4',
    '100': '#e0d9ce',
    '50': '#ebe7e0',
}

prefixes = ['', 'dark:', 'hover:', 'focus:', 'active:', 'disabled:', 'group-hover:']
properties = [
    'bg', 'text', 'border', 'ring', 'shadow', 'placeholder',
    'from', 'to', 'via',
    'border-t', 'border-b', 'border-l', 'border-r',
    'decoration',
]

def replace_colors(content):
    # 特殊：bg-white / text-white / border-white
    content = content.replace('bg-white', 'bg-[#f5f2ed]')
    content = content.replace('text-white', 'text-[#f5f2ed]')
    content = content.replace('border-white', 'border-[#f5f2ed]')
    content = content.replace('dark:bg-white', 'dark:bg-[#c4bdb4]')
    content = content.replace('dark:text-white', 'dark:text-[#c4bdb4]')
    content = content.replace('dark:border-white', 'dark:border-[#c4bdb4]')

    # 处理 zinc 色系（精确匹配 + 透明度变体）
    for prop in properties:
        for prefix in prefixes:
            full_prefix = prefix + prop if prefix else prop
            for shade, color in color_map.items():
                old = f"{full_prefix}-zinc-{shade}"
                new = f"{full_prefix}-[{color}]"
                # 精确匹配
                pattern = r'(?<![\w/])' + re.escape(old) + r'(?![\w/])'
                content = re.sub(pattern, new, content)
                # 透明度变体
                pattern_op = r'(?<![\w/])' + re.escape(old) + r'/([\d]+)(?![\w/])'
                replacement_op = new + r'/\1'
                content = re.sub(pattern_op, replacement_op, content)

    # 特殊透明度映射
    specials = [
        ('dark:border-white/5', 'dark:border-[#2a2520]/20'),
        ('dark:border-white/10', 'dark:border-[#c4bdb4]/10'),
        ('dark:ring-white/10', 'dark:ring-[#c4bdb4]/10'),
        ('bg-black/40', 'bg-[#0c0b09]/40'),
        ('bg-black/50', 'bg-[#0c0b09]/50'),
        ('bg-black/60', 'bg-[#0c0b09]/60'),
    ]
    for old, new in specials:
        content = content.replace(old, new)

    return content

for filepath in sys.argv[1:]:
    p = Path(filepath)
    if not p.exists():
        print(f"Skip (not found): {filepath}")
        continue
    content = p.read_text()
    new_content = replace_colors(content)
    if content != new_content:
        p.write_text(new_content)
        print(f"Updated: {filepath}")
    else:
        print(f"No changes: {filepath}")
