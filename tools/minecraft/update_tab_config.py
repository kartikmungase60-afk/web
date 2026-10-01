import yaml
import os

backup_file = r'C:\Users\Kartikplayzz\.gemini\antigravity-ide\scratch\battlepie-clone\backups\tab_backup_1790885763815\config.yml'
with open(backup_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace header logo with single-quoted string so colon doesn't trigger YAML key syntax
new_content = content.replace(
    '<shadow:#000000FF>#FFA500&lMINEORANGE',
    "'<shadow:#1D0E46FF>:mineorange_logo:'",
    1
)

# Replace scoreboard title
new_content = new_content.replace(
    'title: <shadow:#000000FF>#FFA500&lMINEORANGE',
    "title: '<shadow:#1D0E46FF>:mineorange_small:'",
    1
)

# Validate with PyYAML
parsed = yaml.safe_load(new_content)
print('YAML validation successful!')
print('Header line 1:', parsed['header-footer']['designs']['default']['header'][1])
print('Scoreboard title:', parsed['scoreboard']['scoreboards']['default']['title'])

out_file = r'C:\Users\Kartikplayzz\.gemini\antigravity-ide\scratch\battlepie-clone\tools\minecraft\tab_updated_config.yml'
with open(out_file, 'w', encoding='utf-8') as f:
    f.write(new_content)
print('Saved updated config to:', out_file)
