import yaml
import os

config_path = r'tools\minecraft\tab_updated_config.yml'
with open(config_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace :mineorange_logo: with golden-orange 3D Minecraft gradient matching minecraft_title (2).png
content = content.replace(
    "'<shadow:#000000FF>:mineorange_logo:'",
    "'<shadow:#000000FF><gradient:#FFE600:#FFAC00:#D45500>&lMINE ORANGE</gradient>'"
)
content = content.replace(
    "<shadow:#000000FF>:mineorange_logo:",
    "'<shadow:#000000FF><gradient:#FFE600:#FFAC00:#D45500>&lMINE ORANGE</gradient>'"
)

# Replace :mineorange_small: in scoreboard title
content = content.replace(
    "title: '<shadow:#000000FF>:mineorange_small:'",
    "title: '<shadow:#000000FF><gradient:#FFE600:#FFAC00:#D45500>&lMINE ORANGE</gradient>'"
)
content = content.replace(
    "title: <shadow:#000000FF>:mineorange_small:",
    "title: '<shadow:#000000FF><gradient:#FFE600:#FFAC00:#D45500>&lMINE ORANGE</gradient>'"
)

# Validate YAML
parsed = yaml.safe_load(content)
print('YAML valid!')
print('Header line 1:', parsed['header-footer']['designs']['default']['header'][1])
print('Scoreboard title:', parsed['scoreboard']['scoreboards']['default']['title'])

with open(config_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated', config_path)
