require 'sinatra/base'
require 'sinatra/reloader'
require_relative('erlang')
require 'json'


class WebApp < Sinatra::Base

  # set all the settings!
  configure do
    # this is arguably not necessary... 'public'
    # folder is the static content location by default
    set :public_folder, 'public'

    # optionally configure Cache-Control headers on responses
    # set :static_cache_control, [:public, :max_age => 300]

    # if using mime types not known to Sinatra, uncomment and
    # configure here (by file extension)
    # mime_type :foo, 'text/foo'
  end

  get "/" do
    redirect '/index.html'
  end

  get '/hello' do
      "Hello"
  end


def assoc_to_hash(assoc)
  Hash[assoc.map{|e|
    if e.is_a?(Erlang::Tuple)
      [e.to_a[0], e.to_a[1]]
    else
      [nil, e]
    end
  }]
end


  get '/procs' do
      node = "test01@hoge"
      cookie = File.read(ENV['HOME']+"/.erlang.cookie")
      erl = Erlang::Erl.new(node, cookie)

      proc_infos = erl.nodes.reduce([]){|acc, node|
        procs = erl.rpc_call(node, :erlang, :processes, [])
        acc += procs.map{|proc|
          info = erl.rpc_call(node, :erlang, :process_info, [proc, [:initial_call, :links, :monitors, :message_queue_len, :total_heap_size ]])
          if info != :undefined
            infomap = assoc_to_hash(info)
            infomap.merge({name: proc, alive: true, init_module: infomap[:initial_call].to_a[0]})
          else
            {name: proc, alive: false}
          end
        }
      }
      erl.down()

      content_type :json
      JSON.generate({status: 'ok', procs: proc_infos})
  end

end
